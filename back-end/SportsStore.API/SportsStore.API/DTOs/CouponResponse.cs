using SportsStore.API.Models;

namespace SportsStore.API.DTOs
{
    public class CouponResponse
    {
        public int Id { get; set; }
        public string Code { get; set; } = string.Empty;
        public CouponDiscountType DiscountType { get; set; }
        public decimal DiscountValue { get; set; }
        public decimal MinimumOrderAmount { get; set; }
        public decimal? MaximumDiscountAmount { get; set; }
        public DateTimeOffset? ValidFromUtc { get; set; }
        public DateTimeOffset? ValidUntilUtc { get; set; }
        public int? MaxRedemptions { get; set; }
        public int RedemptionsCount { get; set; }
        public bool IsActive { get; set; }
    }
}