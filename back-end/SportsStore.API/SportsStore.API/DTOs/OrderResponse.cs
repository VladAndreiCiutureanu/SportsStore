using SportsStore.API.Models;

namespace SportsStore.API.DTOs
{
    public class OrderResponse
    {
        public int Id { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTimeOffset CreatedAtUtc { get; set; }
        public string RecipientName { get; set; } = string.Empty;
        public string AddressLine1 { get; set; } = string.Empty;
        public string? AddressLine2 { get; set; }
        public string City { get; set; } = string.Empty;
        public string? Region { get; set; }
        public string PostalCode { get; set; } = string.Empty;
        public string CountryCode { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public string DeliveryMethodName { get; set; } = string.Empty;
        public decimal DeliveryCost { get; set; }
        public decimal Subtotal { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal Total { get; set; }
        public string? CouponCode { get; set; }
        public List<OrderLineResponse> Items { get; set; } = new();
    }

    public class OrderLineResponse
    {
        public int ProductId { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public decimal UnitPrice { get; set; }
        public int Quantity { get; set; }
        public decimal LineTotal { get; set; }
    }
}