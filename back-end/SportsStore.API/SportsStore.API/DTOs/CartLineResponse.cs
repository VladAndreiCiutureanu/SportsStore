namespace SportsStore.API.DTOs
{
    public class CartLineResponse
    {
        public ProductResponse Product { get; set; } = null!;
        public int Quantity { get; set; }
        public decimal LineTotal { get; set; }
    }
}