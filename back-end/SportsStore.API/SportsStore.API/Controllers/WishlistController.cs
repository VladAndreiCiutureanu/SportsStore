using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SportsStore.API.Database;
using SportsStore.API.DTOs;
using SportsStore.API.Models;
using System.Security.Claims;

namespace SportsStore.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class WishlistController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public WishlistController(ApplicationDbContext context)
        {
            _context = context;
        }

        private string? GetCurrentUserId()
        {
            return User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
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
                DeliveryMethods = product.DeliveryMethods.Select(method => new DeliveryMethodResponse
                {
                    Id = method.Id,
                    Name = method.Name,
                    Cost = method.Cost
                })
                .ToList()
            };
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<ProductResponse>>> GetWishlist()
        {
            var userId = GetCurrentUserId();

            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized();
            }

            var favorites = await _context.WishlistItems.AsNoTracking()
                .Where(wishlistItem => wishlistItem.UserId == userId)
                .Include(wishlistItem => wishlistItem.Product)
                    .ThenInclude(product => product.Category)
                .Include(wishlistItem => wishlistItem.Product)
                    .ThenInclude(product => product.DeliveryMethods)
                .ToListAsync();

            return Ok(favorites.Select(favorite => ToProductResponse(favorite.Product)));
        }

        [HttpPost("{productId:int}")]
        public async Task<IActionResult> AddFavorite(int productId)
        {
            var userId = GetCurrentUserId();

            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized();
            }

            var productExists = await _context.Products.AnyAsync(product => product.Id == productId);

            if (!productExists)
            {
                return NotFound("Product not found.");
            }

            var alreadyFavorite = await _context.WishlistItems.AnyAsync(favorite => favorite.UserId == userId && favorite.ProductId == productId);

            if (alreadyFavorite)
            {
                return NoContent();
            }

            _context.WishlistItems.Add(new WishlistItem
            {
                UserId = userId,
                ProductId = productId
            });

            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpDelete("{productId:int}")]
        public async Task<IActionResult> RemoveFavorite(int productId)
        {
            var userId = GetCurrentUserId();

            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized();
            }

            var favorite = await _context.WishlistItems.FirstOrDefaultAsync(favorite => favorite.UserId == userId && favorite.ProductId == productId);

            if (favorite is null)
            {
                return NotFound("Favorite product not found.");
            }

            _context.WishlistItems.Remove(favorite);

            await _context.SaveChangesAsync();

            return NoContent();
        }


    }
}
