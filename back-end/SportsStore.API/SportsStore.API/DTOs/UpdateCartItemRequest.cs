using System.ComponentModel.DataAnnotations;

namespace SportsStore.API.DTOs
{
    public class UpdateCartItemRequest
    {
        [Range(1, int.MaxValue)]
        public int Quantity { get; set; }
    }
}