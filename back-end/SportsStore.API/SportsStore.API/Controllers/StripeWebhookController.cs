using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SportsStore.API.Database;
using SportsStore.API.Models;
using Stripe;
using Stripe.Checkout;

namespace SportsStore.API.Controllers
{
    [ApiController]
    [Route("api/stripe/webhook")]
    [AllowAnonymous]
    public class StripeWebhookController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly ILogger<StripeWebhookController> _logger;

        public StripeWebhookController(
            ApplicationDbContext context,
            IConfiguration configuration,
            ILogger<StripeWebhookController> logger)
        {
            _context = context;
            _configuration = configuration;
            _logger = logger;
        }

        [HttpPost]
        public async Task<IActionResult> Handle()
        {
            var webhookSecret = _configuration["Stripe:WebhookSecret"];
            if (string.IsNullOrWhiteSpace(webhookSecret))
            {
                return StatusCode(StatusCodes.Status503ServiceUnavailable);
            }

            using var reader = new StreamReader(HttpContext.Request.Body);
            var payload = await reader.ReadToEndAsync();
            var signature = Request.Headers["Stripe-Signature"].ToString();

            Event stripeEvent;
            try
            {
                stripeEvent = EventUtility.ConstructEvent(payload, signature, webhookSecret);
            }
            catch (Exception exception) when (exception is StripeException or System.Text.Json.JsonException)
            {
                _logger.LogWarning(exception, "Rejected Stripe webhook with an invalid signature or payload.");
                return BadRequest();
            }

            if (stripeEvent.Type is not "checkout.session.completed"
                and not "checkout.session.async_payment_succeeded"
                and not "checkout.session.async_payment_failed"
                and not "checkout.session.expired")
            {
                return Ok();
            }

            if (stripeEvent.Data.Object is not Session session)
            {
                return BadRequest();
            }

            var orderIdText = session.Metadata?.GetValueOrDefault("orderId")
                ?? session.ClientReferenceId;
            if (!int.TryParse(orderIdText, out var orderId))
            {
                return BadRequest();
            }

            var order = await _context.Orders
                .Include(item => item.Items)
                .FirstOrDefaultAsync(item =>
                    item.Id == orderId && item.StripeCheckoutSessionId == session.Id);

            if (order is null)
            {
                return NotFound();
            }

            if (order.Status != OrderStatus.PendingPayment)
            {
                return Ok();
            }

            if (stripeEvent.Type is "checkout.session.expired" or "checkout.session.async_payment_failed")
            {
                order.Status = stripeEvent.Type == "checkout.session.expired"
                    ? OrderStatus.Cancelled
                    : OrderStatus.PaymentFailed;
                await _context.SaveChangesAsync();
                return Ok();
            }

            if (session.PaymentStatus != "paid")
            {
                return Ok();
            }

            await using var transaction = await _context.Database.BeginTransactionAsync();
            var productIds = order.Items.Select(item => item.ProductId).Distinct().ToList();
            var products = await _context.Products
                .Where(product => productIds.Contains(product.Id))
                .ToDictionaryAsync(product => product.Id);

            var stockAvailable = order.Items.All(item =>
                products.TryGetValue(item.ProductId, out var product) && product.Stock >= item.Quantity);

            if (stockAvailable)
            {
                foreach (var item in order.Items)
                {
                    products[item.ProductId].Stock -= item.Quantity;
                }

                order.Status = OrderStatus.Paid;
            }
            else
            {
                // Payment succeeded, but the stock changed while Checkout was open.
                // Keep the payment recorded and flag the order for manual resolution.
                order.Status = OrderStatus.PaidNeedsReview;
                _logger.LogError("Paid order {OrderId} needs stock review.", order.Id);
            }

            if (order.CouponId.HasValue)
            {
                var coupon = await _context.Coupons
                    .FirstOrDefaultAsync(item => item.Id == order.CouponId.Value);
                if (coupon is not null)
                {
                    coupon.RedemptionsCount++;
                }
            }

            var purchasedProductIds = order.Items.Select(item => item.ProductId).ToList();
            var cartItems = await _context.CartItems
                .Where(item => item.UserId == order.UserId && purchasedProductIds.Contains(item.ProductId))
                .ToListAsync();

            foreach (var cartItem in cartItems)
            {
                var orderedQuantity = order.Items
                    .Where(item => item.ProductId == cartItem.ProductId)
                    .Sum(item => item.Quantity);

                if (cartItem.Quantity <= orderedQuantity)
                {
                    _context.CartItems.Remove(cartItem);
                }
                else
                {
                    cartItem.Quantity -= orderedQuantity;
                }
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
            return Ok();
        }
    }
}