using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using SportsStore.API.Models;

namespace SportsStore.API.Database
{
    public class ApplicationDbContext : IdentityDbContext<IdentityUser, IdentityRole, string>
    {
        public DbSet<Product> Products => Set<Product>();
        public DbSet<Category> Categories => Set<Category>();
        public DbSet<DeliveryMethod> DeliveryMethods => Set<DeliveryMethod>();


        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
        {

        }

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            // Deleting a category that has products should not be allowed, so we set the delete behavior to Restrict
            builder.Entity<Product>()
                .HasOne(product => product.Category)
                .WithMany(category => category.Products)
                .HasForeignKey(product => product.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.Entity<Product>()
                .HasMany(product => product.DeliveryMethods)
                .WithMany(method => method.Products)
                .UsingEntity(join => join.ToTable("ProductDeliveryMethods"));

        }
    }
}
