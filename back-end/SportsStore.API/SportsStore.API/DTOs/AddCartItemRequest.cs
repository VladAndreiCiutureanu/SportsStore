using System.ComponentModel.DataAnnotations;

namespace SportsStore.API.DTOs
{
    public class AddCartItemRequest
    {
        [Range(1, int.MaxValue)]
        public int ProductId { get; set; }

        [Range(1, int.MaxValue)]
        public int Quantity { get; set; } = 1;
    }
}