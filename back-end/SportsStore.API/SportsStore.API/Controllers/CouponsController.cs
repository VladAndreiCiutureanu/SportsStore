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
    public class CouponsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public CouponsController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<IEnumerable<CouponResponse>>> GetCoupons()
        {
            var coupons = await _context.Coupons
                .AsNoTracking()
                .OrderBy(coupon => coupon.Code)
                .Select(coupon => new CouponResponse
                {
                    Id = coupon.Id,
                    Code = coupon.Code,
                    DiscountType = coupon.DiscountType,
                    DiscountValue = coupon.DiscountValue,
                    MinimumOrderAmount = coupon.MinimumOrderAmount,
                    MaximumDiscountAmount = coupon.MaximumDiscountAmount,
                    ValidFromUtc = coupon.ValidFromUtc,
                    ValidUntilUtc = coupon.ValidUntilUtc,
                    MaxRedemptions = coupon.MaxRedemptions,
                    RedemptionsCount = coupon.RedemptionsCount,
                    IsActive = coupon.IsActive
                })
                .ToListAsync();

            return Ok(coupons);
        }

        [HttpGet("{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<CouponResponse>> GetCoupon(int id)
        {
            var coupon = await _context.Coupons
                .AsNoTracking()
                .Where(item => item.Id == id)
                .Select(item => new CouponResponse
                {
                    Id = item.Id,
                    Code = item.Code,
                    DiscountType = item.DiscountType,
                    DiscountValue = item.DiscountValue,
                    MinimumOrderAmount = item.MinimumOrderAmount,
                    MaximumDiscountAmount = item.MaximumDiscountAmount,
                    ValidFromUtc = item.ValidFromUtc,
                    ValidUntilUtc = item.ValidUntilUtc,
                    MaxRedemptions = item.MaxRedemptions,
                    RedemptionsCount = item.RedemptionsCount,
                    IsActive = item.IsActive
                })
                .FirstOrDefaultAsync();

            return coupon is null ? NotFound() : Ok(coupon);
        }
        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<CouponResponse>> CreateCoupon(CouponRequest request)
        {
            if (!Enum.IsDefined(request.DiscountType))
            {
                return BadRequest("Unknown discount type.");
            }

            if (request.DiscountType == CouponDiscountType.Percentage && request.DiscountValue > 100m)
            {
                return BadRequest("A percentage discount cannot exceed 100%.");
            }

            if (request.DiscountType == CouponDiscountType.FixedAmount && request.MaximumDiscountAmount.HasValue)
            {
                return BadRequest("MaximumDiscountAmount can only be used with percentage discounts.");
            }

            if (request.ValidFromUtc.HasValue && request.ValidUntilUtc.HasValue &&
                request.ValidFromUtc.Value >= request.ValidUntilUtc.Value)
            {
                return BadRequest("ValidFromUtc must be earlier than ValidUntilUtc.");
            }

            var code = request.Code.Trim().ToUpperInvariant();
            if (await _context.Coupons.AnyAsync(coupon => coupon.Code == code))
            {
                return Conflict(new { message = $"Coupon '{code}' already exists." });
            }

            var coupon = new Coupon
            {
                Code = code,
                DiscountType = request.DiscountType,
                DiscountValue = request.DiscountValue,
                MinimumOrderAmount = request.MinimumOrderAmount,
                MaximumDiscountAmount = request.MaximumDiscountAmount,
                ValidFromUtc = request.ValidFromUtc,
                ValidUntilUtc = request.ValidUntilUtc,
                MaxRedemptions = request.MaxRedemptions,
                IsActive = request.IsActive
            };

            _context.Coupons.Add(coupon);
            await _context.SaveChangesAsync();

            var response = new CouponResponse
            {
                Id = coupon.Id,
                Code = coupon.Code,
                DiscountType = coupon.DiscountType,
                DiscountValue = coupon.DiscountValue,
                MinimumOrderAmount = coupon.MinimumOrderAmount,
                MaximumDiscountAmount = coupon.MaximumDiscountAmount,
                ValidFromUtc = coupon.ValidFromUtc,
                ValidUntilUtc = coupon.ValidUntilUtc,
                MaxRedemptions = coupon.MaxRedemptions,
                RedemptionsCount = coupon.RedemptionsCount,
                IsActive = coupon.IsActive
            };

            return CreatedAtAction(nameof(GetCoupon), new { id = coupon.Id }, response);
        }
    }
}