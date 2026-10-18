namespace SportsStore.API.DTOs
{
    public class ProductResponse
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? Specifications { get; set; }
        public decimal Price { get; set; }
        public int Stock { get; set; }
        public string Supplier { get; set; } = string.Empty;
        public string? ImageUrl { get; set; }

        public int CategoryId { get; set; }
        public string CategoryName { get; set; } = string.Empty;

        public List<DeliveryMethodResponse> DeliveryMethods { get; set; } = new List<DeliveryMethodResponse>();
    }
}
