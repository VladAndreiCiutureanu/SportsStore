namespace SportsStore.API.DTOs
{
    public class CheckoutResponse
    {
        public int OrderId { get; set; }
        public string Status { get; set; } = string.Empty;
        public string CheckoutUrl { get; set; } = string.Empty;
        public decimal Subtotal { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal DeliveryCost { get; set; }
        public decimal Total { get; set; }
        public string? CouponCode { get; set; }
    }
}