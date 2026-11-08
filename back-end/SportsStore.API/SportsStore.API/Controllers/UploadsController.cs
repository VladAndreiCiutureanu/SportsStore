using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SportsStore.API.Controllers
{
    /// <summary>
    /// Incarcarea imaginilor de produs de pe calculatorul Admin-ului.
    /// Fisierul se salveaza in wwwroot/images/products cu un nume unic, iar raspunsul contine
    /// adresa lui (ex. "/images/products/3f2a....jpg"). Adresa se pune apoi in Product.ImageUrl,
    /// la fel ca un URL extern, deci restul API-ului ramane neschimbat.
    /// </summary>
    [ApiController]
    [Route("api/uploads")]
    [Authorize(Roles = "Admin")]
    public class UploadsController : ControllerBase
    {
        public const long MaxImageBytes = 5 * 1024 * 1024; // 5 MB
        private const string ProductImagesFolder = "images/products";

        private readonly IWebHostEnvironment _environment;
        private readonly ILogger<UploadsController> _logger;

        public UploadsController(IWebHostEnvironment environment, ILogger<UploadsController> logger)
        {
            _environment = environment;
            _logger = logger;
        }

        public record UploadImageResponse(string Url, long Size, string ContentType);

        [HttpPost("product-image")]
        [RequestSizeLimit(MaxImageBytes + 64 * 1024)] // + putin loc pentru antetul multipart
        [RequestFormLimits(MultipartBodyLengthLimit = MaxImageBytes + 64 * 1024)]
        public async Task<ActionResult<UploadImageResponse>> UploadProductImage(IFormFile? file)
        {
            if (file is null || file.Length == 0)
            {
                return BadRequest("No image file was provided.");
            }

            if (file.Length > MaxImageBytes)
            {
                return BadRequest($"The image is too large. Maximum size is {MaxImageBytes / (1024 * 1024)} MB.");
            }

            // Tipul real se afla din primii octeti ai fisierului, nu din nume sau din Content-Type
            // (pe care clientul le poate falsifica). Asa nu se poate urca un .exe redenumit in .jpg.
            var header = new byte[12];
            await using (var peek = file.OpenReadStream())
            {
                var read = await peek.ReadAsync(header.AsMemory(0, header.Length));
                if (read < header.Length) Array.Resize(ref header, read);
            }

            var detected = DetectImageType(header);
            if (detected is null)
            {
                return BadRequest("Only JPG, PNG, WEBP or GIF images are allowed.");
            }

            var webRoot = _environment.WebRootPath ?? Path.Combine(_environment.ContentRootPath, "wwwroot");
            var folder = Path.Combine(webRoot, ProductImagesFolder.Replace('/', Path.DirectorySeparatorChar));
            Directory.CreateDirectory(folder);

            // Nume generat de server: niciodata numele trimis de client (evita suprascrieri si cai periculoase).
            var fileName = $"{Guid.NewGuid():N}{detected.Value.Extension}";
            var fullPath = Path.Combine(folder, fileName);

            await using (var target = System.IO.File.Create(fullPath))
            {
                await file.CopyToAsync(target);
            }

            _logger.LogInformation("Product image uploaded: {FileName} ({Size} bytes)", fileName, file.Length);

            var url = $"/{ProductImagesFolder}/{fileName}";
            return Created(url, new UploadImageResponse(url, file.Length, detected.Value.ContentType));
        }

        private static (string Extension, string ContentType)? DetectImageType(byte[] h)
        {
            if (h.Length >= 3 && h[0] == 0xFF && h[1] == 0xD8 && h[2] == 0xFF)
                return (".jpg", "image/jpeg");
            if (h.Length >= 8 && h[0] == 0x89 && h[1] == 0x50 && h[2] == 0x4E && h[3] == 0x47
                && h[4] == 0x0D && h[5] == 0x0A && h[6] == 0x1A && h[7] == 0x0A)
                return (".png", "image/png");
            if (h.Length >= 4 && h[0] == 0x47 && h[1] == 0x49 && h[2] == 0x46 && h[3] == 0x38)
                return (".gif", "image/gif");
            if (h.Length >= 12 && h[0] == 0x52 && h[1] == 0x49 && h[2] == 0x46 && h[3] == 0x46
                && h[8] == 0x57 && h[9] == 0x45 && h[10] == 0x42 && h[11] == 0x50)
                return (".webp", "image/webp");
            return null;
        }
    }
}
