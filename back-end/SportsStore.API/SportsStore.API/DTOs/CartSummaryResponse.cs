namespace SportsStore.API.DTOs
{
    public class CartSummaryResponse
    {
        public List<CartLineResponse> Items { get; set; } = new();
        public decimal Subtotal { get; set; }
        public List<DeliveryMethodResponse> AvailableDeliveryMethods { get; set; } = new();
        public DeliveryMethodResponse? DeliveryMethod { get; set; }
        public decimal? DeliveryCost { get; set; }
        public decimal? Total { get; set; }
    }
}