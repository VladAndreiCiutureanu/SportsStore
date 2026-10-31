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
        public DbSet<WishlistItem> WishlistItems => Set<WishlistItem>();
        public DbSet<CartItem> CartItems => Set<CartItem>();
        public DbSet<Order> Orders => Set<Order>();
        public DbSet<OrderItem> OrderItems => Set<OrderItem>();
        public DbSet<Coupon> Coupons => Set<Coupon>();


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

            builder.Entity<WishlistItem>()
                .HasKey(item => new { item.UserId, item.ProductId });

            builder.Entity<WishlistItem>()
                .HasOne(item => item.User)
                .WithMany()
                .HasForeignKey(item => item.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<WishlistItem>()
                .HasOne(item => item.Product)
                .WithMany()
                .HasForeignKey(item => item.ProductId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<CartItem>()
                .HasKey(item => new { item.UserId, item.ProductId });

            builder.Entity<CartItem>()
                .HasOne(item => item.User)
                .WithMany()
                .HasForeignKey(item => item.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<CartItem>()
                .HasOne(item => item.Product)
                .WithMany()
                .HasForeignKey(item => item.ProductId)
                .OnDelete(DeleteBehavior.Cascade);
            builder.Entity<Coupon>()
                .HasIndex(coupon => coupon.Code)
                .IsUnique();

            builder.Entity<Coupon>()
                .Property(coupon => coupon.DiscountType)
                .HasConversion<string>();

            builder.Entity<Order>()
                .Property(order => order.Status)
                .HasConversion<string>()
                .HasMaxLength(32);

            builder.Entity<Order>()
                .HasIndex(order => order.StripeCheckoutSessionId)
                .IsUnique()
                .HasFilter("[StripeCheckoutSessionId] IS NOT NULL");

            builder.Entity<Order>()
                .HasOne(order => order.User)
                .WithMany()
                .HasForeignKey(order => order.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.Entity<Order>()
                .HasOne(order => order.Coupon)
                .WithMany()
                .HasForeignKey(order => order.CouponId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.Entity<Order>()
                .HasMany(order => order.Items)
                .WithOne(item => item.Order)
                .HasForeignKey(item => item.OrderId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
