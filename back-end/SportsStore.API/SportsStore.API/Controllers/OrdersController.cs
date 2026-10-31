using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SportsStore.API.Database;
using SportsStore.API.DTOs;
using SportsStore.API.Models;
using Stripe;
using Stripe.Checkout;

namespace SportsStore.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class OrdersController : ControllerBase
    {
        private const string Currency = "ron";
        private readonly ApplicationDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly ILogger<OrdersController> _logger;

        public OrdersController(
            ApplicationDbContext context,
            IConfiguration configuration,
            ILogger<OrdersController> logger)
        {
            _context = context;
            _configuration = configuration;
            _logger = logger;
        }

        private string? GetCurrentUserId()
        {
            return User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? User.FindFirstValue("sub");
        }

        [HttpGet]
        public async Task<ActionResult<OrderHistoryResponse>> GetOrderHistory(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            var userId = GetCurrentUserId();
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized();
            }

            if (page < 1 || pageSize < 1 || pageSize > 100)
            {
                return BadRequest("Page must be at least 1 and pageSize must be between 1 and 100.");
            }

            var userOrders = _context.Orders
                .AsNoTracking()
                .Where(order => order.UserId == userId);

            var totalCount = await userOrders.CountAsync();
            var orders = await userOrders
                .Include(order => order.Items)
                .OrderByDescending(order => order.CreatedAtUtc)
                .ThenByDescending(order => order.Id)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return Ok(new OrderHistoryResponse
            {
                Page = page,
                PageSize = pageSize,
                TotalCount = totalCount,
                Items = orders.Select(ToOrderResponse).ToList()
            });
        }

        [HttpPost("checkout")]
        public async Task<ActionResult<CheckoutResponse>> CreateCheckout(CheckoutRequest request)
        {
            var userId = GetCurrentUserId();
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized();
            }

            var stripeSecretKey = _configuration["Stripe:SecretKey"];
            var successUrl = _configuration["Stripe:SuccessUrl"];
            if (!string.IsNullOrWhiteSpace(stripeSecretKey) &&
                !stripeSecretKey.StartsWith("sk_test_", StringComparison.Ordinal))
            {
                return StatusCode(StatusCodes.Status503ServiceUnavailable,
                    "Only Stripe test-mode keys are accepted; live payments are disabled.");
            }
            var cancelUrl = _configuration["Stripe:CancelUrl"];
            if (string.IsNullOrWhiteSpace(stripeSecretKey) ||
                string.IsNullOrWhiteSpace(successUrl) ||
                string.IsNullOrWhiteSpace(cancelUrl))
            {
                return StatusCode(StatusCodes.Status503ServiceUnavailable,
                    "Stripe checkout is not configured.");
            }

            var cartItems = await _context.CartItems
                .Where(item => item.UserId == userId)
                .Include(item => item.Product)
                    .ThenInclude(product => product.DeliveryMethods)
                .ToListAsync();

            if (cartItems.Count == 0)
            {
                return BadRequest("The cart is empty.");
            }

            foreach (var item in cartItems)
            {
                if (item.Quantity > item.Product.Stock)
                {
                    return Conflict($"The stock for '{item.Product.Name}' has changed. Update the cart and try again.");
                }
            }

            var deliveryMethod = await _context.DeliveryMethods
                .FirstOrDefaultAsync(method => method.Id == request.DeliveryMethodId);
            if (deliveryMethod is null)
            {
                return NotFound("Delivery method not found.");
            }

            if (cartItems.Any(item => item.Product.DeliveryMethods
                .All(method => method.Id != deliveryMethod.Id)))
            {
                return BadRequest("The selected delivery method is not available for every product in the cart.");
            }

            var subtotal = cartItems.Sum(item => item.Product.Price * item.Quantity);
            SportsStore.API.Models.Coupon? coupon = null;
            var discountAmount = 0m;
            var couponCode = request.CouponCode?.Trim().ToUpperInvariant();

            if (!string.IsNullOrWhiteSpace(couponCode))
            {
                coupon = await _context.Coupons
                    .FirstOrDefaultAsync(item => item.Code == couponCode);

                if (coupon is null || !coupon.IsActive)
                {
                    return BadRequest("The bonus code is invalid or inactive.");
                }

                var now = DateTimeOffset.UtcNow;
                if ((coupon.ValidFromUtc.HasValue && now < coupon.ValidFromUtc.Value) ||
                    (coupon.ValidUntilUtc.HasValue && now > coupon.ValidUntilUtc.Value))
                {
                    return BadRequest("The bonus code is not currently valid.");
                }

                if (coupon.MaxRedemptions.HasValue &&
                    coupon.RedemptionsCount >= coupon.MaxRedemptions.Value)
                {
                    return BadRequest("The bonus code has reached its redemption limit.");
                }

                if (subtotal < coupon.MinimumOrderAmount)
                {
                    return BadRequest($"The order subtotal must be at least {coupon.MinimumOrderAmount:0.00} RON to use this code.");
                }

                discountAmount = coupon.DiscountType == CouponDiscountType.Percentage
                    ? subtotal * coupon.DiscountValue / 100m
                    : Math.Min(coupon.DiscountValue, subtotal);

                if (coupon.MaximumDiscountAmount.HasValue)
                {
                    discountAmount = Math.Min(discountAmount, coupon.MaximumDiscountAmount.Value);
                }

                discountAmount = Math.Round(discountAmount, 2, MidpointRounding.AwayFromZero);
            }

            var total = subtotal - discountAmount + deliveryMethod.Cost;
            if (total < 2m)
            {
                return BadRequest("The total must be at least 2.00 RON to pay with Stripe.");
            }

            var order = new Order
            {
                UserId = userId,
                RecipientName = request.RecipientName.Trim(),
                AddressLine1 = request.AddressLine1.Trim(),
                AddressLine2 = request.AddressLine2?.Trim(),
                City = request.City.Trim(),
                Region = request.Region?.Trim(),
                PostalCode = request.PostalCode.Trim(),
                CountryCode = request.CountryCode.Trim().ToUpperInvariant(),
                Phone = request.Phone?.Trim(),
                DeliveryMethodName = deliveryMethod.Name,
                DeliveryCost = deliveryMethod.Cost,
                Subtotal = subtotal,
                DiscountAmount = discountAmount,
                Total = total,
                CouponCode = couponCode,
                CouponId = coupon?.Id,
                Status = OrderStatus.PendingPayment,
                Items = cartItems.Select(item => new OrderItem
                {
                    ProductId = item.ProductId,
                    ProductName = item.Product.Name,
                    UnitPrice = item.Product.Price,
                    Quantity = item.Quantity,
                    LineTotal = item.Product.Price * item.Quantity
                }).ToList()
            };

            _context.Orders.Add(order);
            await _context.SaveChangesAsync();

            var itemDescription = string.Join(", ", order.Items
                .Select(item => $"{item.Quantity} x {item.ProductName}"));
            if (itemDescription.Length > 450)
            {
                itemDescription = itemDescription[..450];
            }

            var sessionOptions = new SessionCreateOptions
            {
                Mode = "payment",
                AllowedPaymentMethodTypes = new List<string> { "card" },
                SuccessUrl = successUrl.Replace("{ORDER_ID}", order.Id.ToString(), StringComparison.Ordinal),
                CancelUrl = cancelUrl.Replace("{ORDER_ID}", order.Id.ToString(), StringComparison.Ordinal),
                ClientReferenceId = order.Id.ToString(),
                Metadata = new Dictionary<string, string>
                {
                    ["orderId"] = order.Id.ToString()
                },
                LineItems = new List<SessionLineItemOptions>
                {
                    new()
                    {
                        Quantity = 1,
                        PriceData = new SessionLineItemPriceDataOptions
                        {
                            Currency = Currency,
                            UnitAmount = ToMinorUnits(order.Total),
                            ProductData = new SessionLineItemPriceDataProductDataOptions
                            {
                                Name = $"Order #{order.Id}",
                                Description = itemDescription
                            }
                        }
                    }
                }
            };

            try
            {
                var stripeClient = new StripeClient(stripeSecretKey);
                var session = await new SessionService(stripeClient).CreateAsync(sessionOptions);
                order.StripeCheckoutSessionId = session.Id;
                await _context.SaveChangesAsync();

                return Ok(new CheckoutResponse
                {
                    OrderId = order.Id,
                    Status = order.Status.ToString(),
                    CheckoutUrl = session.Url,
                    Subtotal = order.Subtotal,
                    DiscountAmount = order.DiscountAmount,
                    DeliveryCost = order.DeliveryCost,
                    Total = order.Total,
                    CouponCode = order.CouponCode
                });
            }
            catch (StripeException exception)
            {
                _logger.LogError(exception, "Stripe checkout session creation failed for order {OrderId}.", order.Id);
                _context.Orders.Remove(order);
                await _context.SaveChangesAsync();
                return StatusCode(StatusCodes.Status502BadGateway,
                    "The payment provider could not start checkout. Please try again.");
            }
        }

        [HttpGet("{id:int}")]
        public async Task<ActionResult<OrderResponse>> GetOrder(int id)
        {
            var userId = GetCurrentUserId();
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized();
            }

            var order = await _context.Orders
                .AsNoTracking()
                .Include(item => item.Items)
                .FirstOrDefaultAsync(item => item.Id == id && item.UserId == userId);

            if (order is null)
            {
                return NotFound();
            }

            return Ok(ToOrderResponse(order));
        }

        internal static OrderResponse ToOrderResponse(Order order)
        {
            return new OrderResponse
            {
                Id = order.Id,
                Status = order.Status.ToString(),
                CreatedAtUtc = order.CreatedAtUtc,
                RecipientName = order.RecipientName,
                AddressLine1 = order.AddressLine1,
                AddressLine2 = order.AddressLine2,
                City = order.City,
                Region = order.Region,
                PostalCode = order.PostalCode,
                CountryCode = order.CountryCode,
                Phone = order.Phone,
                DeliveryMethodName = order.DeliveryMethodName,
                DeliveryCost = order.DeliveryCost,
                Subtotal = order.Subtotal,
                DiscountAmount = order.DiscountAmount,
                Total = order.Total,
                CouponCode = order.CouponCode,
                Items = order.Items.Select(item => new OrderLineResponse
                {
                    ProductId = item.ProductId,
                    ProductName = item.ProductName,
                    UnitPrice = item.UnitPrice,
                    Quantity = item.Quantity,
                    LineTotal = item.LineTotal
                }).ToList()
            };
        }

        private static long ToMinorUnits(decimal amount)
        {
            return decimal.ToInt64(decimal.Round(amount * 100m, 0, MidpointRounding.AwayFromZero));
        }
    }
}
