using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace SportsStore.API.Models
{
    public enum CouponDiscountType
    {
        Percentage,
        FixedAmount
    }

    public class Coupon
    {
        public int Id { get; set; }

        [Required]
        [StringLength(64)]
        public string Code { get; set; } = string.Empty;

        [Required]
        public CouponDiscountType DiscountType { get; set; }

        [Precision(18, 2)]
        [Range(typeof(decimal), "0.01", "9999999999999999.99")]
        public decimal DiscountValue { get; set; }

        [Precision(18, 2)]
        [Range(typeof(decimal), "0.00", "9999999999999999.99")]
        public decimal MinimumOrderAmount { get; set; }

        [Precision(18, 2)]
        [Range(typeof(decimal), "0.01", "9999999999999999.99")]
        public decimal? MaximumDiscountAmount { get; set; }

        public DateTimeOffset? ValidFromUtc { get; set; }
        public DateTimeOffset? ValidUntilUtc { get; set; }
        public int? MaxRedemptions { get; set; }
        public int RedemptionsCount { get; set; }
        public bool IsActive { get; set; } = true;
    }
}