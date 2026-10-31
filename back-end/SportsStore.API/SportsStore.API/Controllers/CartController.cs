using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SportsStore.API.Database;
using SportsStore.API.DTOs;
using SportsStore.API.Models;

namespace SportsStore.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class CartController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public CartController(ApplicationDbContext context)
        {
            _context = context;
        }

        private string? GetCurrentUserId()
        {
            return User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? User.FindFirstValue("sub");
        }

        [HttpGet]
        public async Task<ActionResult<CartSummaryResponse>> GetCart(
            [FromQuery] int? deliveryMethodId)
        {
            var userId = GetCurrentUserId();
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized();
            }

            var cartItems = await _context.CartItems
                .AsNoTracking()
                .Where(item => item.UserId == userId)
                .Include(item => item.Product)
                    .ThenInclude(product => product.Category)
                .Include(item => item.Product)
                    .ThenInclude(product => product.DeliveryMethods)
                .OrderBy(item => item.Product.Name)
                .ToListAsync();

            var lines = cartItems.Select(item => new CartLineResponse
            {
                Product = ToProductResponse(item.Product),
                Quantity = item.Quantity,
                LineTotal = item.Product.Price * item.Quantity
            }).ToList();

            var subtotal = lines.Sum(line => line.LineTotal);
            var availableDeliveryMethods = cartItems.Count == 0
                ? new List<DeliveryMethod>()
                : cartItems[0].Product.DeliveryMethods
                    .Where(method => cartItems.All(item =>
                        item.Product.DeliveryMethods.Any(productMethod =>
                            productMethod.Id == method.Id)))
                    .OrderBy(method => method.Name)
                    .ToList();

            var availableDeliveryMethodResponses = availableDeliveryMethods
                .Select(method => new DeliveryMethodResponse
                {
                    Id = method.Id,
                    Name = method.Name,
                    Cost = method.Cost
                })
                .ToList();

            if (cartItems.Count == 0 || !deliveryMethodId.HasValue)
            {
                return Ok(new CartSummaryResponse
                {
                    Items = lines,
                    Subtotal = subtotal,
                    AvailableDeliveryMethods = availableDeliveryMethodResponses
                });
            }

            var deliveryMethod = availableDeliveryMethods
                .FirstOrDefault(method => method.Id == deliveryMethodId.Value);

            if (deliveryMethod is null)
            {
                var methodExists = await _context.DeliveryMethods
                    .AnyAsync(method => method.Id == deliveryMethodId.Value);

                if (!methodExists)
                {
                    return NotFound("Delivery method not found.");
                }

                return BadRequest("The selected delivery method is not available for every product in the cart.");
            }

            return Ok(new CartSummaryResponse
            {
                Items = lines,
                Subtotal = subtotal,
                AvailableDeliveryMethods = availableDeliveryMethodResponses,
                DeliveryMethod = new DeliveryMethodResponse
                {
                    Id = deliveryMethod.Id,
                    Name = deliveryMethod.Name,
                    Cost = deliveryMethod.Cost
                },
                DeliveryCost = deliveryMethod.Cost,
                Total = subtotal + deliveryMethod.Cost
            });
        }
        [HttpPost("items")]
        public async Task<IActionResult> AddItem(AddCartItemRequest request)
        {
            var userId = GetCurrentUserId();
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized();
            }

            var product = await _context.Products
                .FirstOrDefaultAsync(product => product.Id == request.ProductId);

            if (product is null)
            {
                return NotFound("Product not found.");
            }

            var cartItem = await _context.CartItems.FirstOrDefaultAsync(item =>
                item.UserId == userId && item.ProductId == request.ProductId);

            var newQuantity = (cartItem?.Quantity ?? 0) + request.Quantity;
            if (newQuantity > product.Stock)
            {
                return BadRequest($"Only {product.Stock} item(s) are currently in stock.");
            }

            if (cartItem is null)
            {
                _context.CartItems.Add(new CartItem
                {
                    UserId = userId,
                    ProductId = request.ProductId,
                    Quantity = request.Quantity
                });
            }
            else
            {
                cartItem.Quantity = newQuantity;
            }

            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpPut("items/{productId:int}")]
        public async Task<IActionResult> UpdateItem(
            int productId,
            UpdateCartItemRequest request)
        {
            var userId = GetCurrentUserId();
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized();
            }

            var cartItem = await _context.CartItems
                .Include(item => item.Product)
                .FirstOrDefaultAsync(item =>
                    item.UserId == userId && item.ProductId == productId);

            if (cartItem is null)
            {
                return NotFound("Product is not in the cart.");
            }

            if (request.Quantity > cartItem.Product.Stock)
            {
                return BadRequest($"Only {cartItem.Product.Stock} item(s) are currently in stock.");
            }

            cartItem.Quantity = request.Quantity;
            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpDelete("items/{productId:int}")]
        public async Task<IActionResult> RemoveItem(int productId)
        {
            var userId = GetCurrentUserId();
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized();
            }

            var cartItem = await _context.CartItems.FirstOrDefaultAsync(item =>
                item.UserId == userId && item.ProductId == productId);

            if (cartItem is null)
            {
                return NotFound("Product is not in the cart.");
            }

            _context.CartItems.Remove(cartItem);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private static ProductResponse ToProductResponse(Product product)
        {
            return new ProductResponse
            {
                Id = product.Id,
                Name = product.Name,
                Description = product.Description,
                Specifications = product.Specifications,
                Price = product.Price,
                Stock = product.Stock,
                Supplier = product.Supplier,
                ImageUrl = product.ImageUrl,
                CategoryId = product.CategoryId,
                CategoryName = product.Category.Name,
                DeliveryMethods = product.DeliveryMethods
                    .Select(method => new DeliveryMethodResponse
                    {
                        Id = method.Id,
                        Name = method.Name,
                        Cost = method.Cost
                    })
                    .ToList()
            };
        }
    }
}