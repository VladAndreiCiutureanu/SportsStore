using System.ComponentModel.DataAnnotations;
using SportsStore.API.Models;

namespace SportsStore.API.DTOs
{
    public class CouponRequest
    {
        [Required]
        [StringLength(64, MinimumLength = 3)]
        public string Code { get; set; } = string.Empty;

        public CouponDiscountType DiscountType { get; set; }

        [Range(typeof(decimal), "0.01", "9999999999999999.99")]
        public decimal DiscountValue { get; set; }

        [Range(typeof(decimal), "0.00", "9999999999999999.99")]
        public decimal MinimumOrderAmount { get; set; }

        [Range(typeof(decimal), "0.01", "9999999999999999.99")]
        public decimal? MaximumDiscountAmount { get; set; }

        public DateTimeOffset? ValidFromUtc { get; set; }
        public DateTimeOffset? ValidUntilUtc { get; set; }

        [Range(1, int.MaxValue)]
        public int? MaxRedemptions { get; set; }

        public bool IsActive { get; set; } = true;
    }
}