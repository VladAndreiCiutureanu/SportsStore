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
    public class DeliveryMethodController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public DeliveryMethodController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        [AllowAnonymous]
        public async Task<ActionResult<IEnumerable<DeliveryMethodResponse>>> GetDeliveryMethods()
        {
            var deliveryMethods = await _context.DeliveryMethods
                .AsNoTracking()
                .OrderBy(method => method.Name)
                .Select(method => new DeliveryMethodResponse
                {
                    Id = method.Id,
                    Name = method.Name
                })
                .ToListAsync();

            return Ok(deliveryMethods);
        }

        [HttpGet("{id:int}")]
        [AllowAnonymous]
        public async Task<ActionResult<DeliveryMethodResponse>> GetDeliveryMethod(int id)
        {
            var deliveryMethod = await _context.DeliveryMethods
                .AsNoTracking()
                .Where(method => method.Id == id)
                .Select(method => new DeliveryMethodResponse
                {
                    Id = method.Id,
                    Name = method.Name
                })
                .FirstOrDefaultAsync();

            if (deliveryMethod is null)
            {
                return NotFound();
            }

            return Ok(deliveryMethod);
        }

        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<DeliveryMethodResponse>> CreateDeliveryMethod(DeliveryMethodRequest request)
        {
            var name = request.Name.Trim();
            var nameExists = await _context.DeliveryMethods.AnyAsync(method => method.Name == name);

            if (nameExists)
            {
                return Conflict(new { message = $"Delivery method with name '{name}' already exists." });
            }

            var deliveryMethod = new DeliveryMethod { Name = name };
            _context.DeliveryMethods.Add(deliveryMethod);
            await _context.SaveChangesAsync();

            var response = new DeliveryMethodResponse
            {
                Id = deliveryMethod.Id,
                Name = deliveryMethod.Name
            };

            return CreatedAtAction(nameof(GetDeliveryMethod), new { id = deliveryMethod.Id }, response);
        }

        [HttpPut("{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateDeliveryMethod(int id, DeliveryMethodRequest request)
        {
            var deliveryMethod = await _context.DeliveryMethods.FindAsync(id);
            if (deliveryMethod is null)
            {
                return NotFound();
            }

            var name = request.Name.Trim();
            var nameExists = await _context.DeliveryMethods
                .AnyAsync(method => method.Id != id && method.Name == name);

            if (nameExists)
            {
                return Conflict(new { message = $"Delivery method with name '{name}' already exists." });
            }

            deliveryMethod.Name = name;
            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpDelete("{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteDeliveryMethod(int id)
        {
            var deliveryMethod = await _context.DeliveryMethods.FindAsync(id);
            if (deliveryMethod is null)
            {
                return NotFound();
            }

            var isUsedByProducts = await _context.Products
                .AnyAsync(product => product.DeliveryMethods.Any(method => method.Id == id));

            if (isUsedByProducts)
            {
                return Conflict(new { message = "Cannot delete a delivery method assigned to products." });
            }

            _context.DeliveryMethods.Remove(deliveryMethod);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}
