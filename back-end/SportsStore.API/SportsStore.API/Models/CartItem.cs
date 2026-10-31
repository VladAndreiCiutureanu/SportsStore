using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Identity;

namespace SportsStore.API.Models
{
    public class CartItem
    {
        public string UserId { get; set; } = string.Empty;
        public IdentityUser User { get; set; } = null!;

        public int ProductId { get; set; }
        public Product Product { get; set; } = null!;

        [Range(1, int.MaxValue)]
        public int Quantity { get; set; }
    }
}