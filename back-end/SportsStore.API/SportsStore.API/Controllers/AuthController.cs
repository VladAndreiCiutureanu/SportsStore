using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using SportsStore.API.DTOs;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace SportsStore.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly UserManager<IdentityUser> _userManager;
        private readonly SignInManager<IdentityUser> _signInManager;
        private readonly IConfiguration _configuration;

        public AuthController(
            UserManager<IdentityUser> userManager,
            SignInManager<IdentityUser> signInManager,
            IConfiguration configuration)
        {
            _userManager = userManager;
            _signInManager = signInManager;
            _configuration = configuration;
        }

        [HttpPost("register")]
        [AllowAnonymous]
        public async Task<IActionResult> Register(RegisterRequest request)
        {
            var user = new IdentityUser
            {
                UserName = request.Username.Trim(),
                Email = request.Email.Trim()
            };

            var createResult = await _userManager.CreateAsync(user, request.Password);

            if (!createResult.Succeeded)
            {
                return BadRequest(new
                {
                    errors = createResult.Errors.Select(error => error.Description)
                });
            }

            var roleResult = await _userManager.AddToRoleAsync(user, "User");

            if (!roleResult.Succeeded)
            {
                await _userManager.DeleteAsync(user); // Rollback user creation if role assignment fails

                return StatusCode(StatusCodes.Status500InternalServerError, new
                {
                    errors = roleResult.Errors.Select(error => error.Description)
                });
            }

            return StatusCode(StatusCodes.Status201Created, new RegisterResponse
            {
                Id = user.Id,
                Username = user.UserName,
                Email = user.Email
            });
        }

        [HttpPost("login")]
        [AllowAnonymous]
        public async Task<IActionResult> Login(LoginRequest request)
        {
            var identifier = request.UsernameOrEmail.Trim();

            var user = await _userManager.FindByNameAsync(identifier);

            if (user is null)
            {
                user = await _userManager.FindByEmailAsync(identifier);
            }

            if (user is null)
            {
                return Unauthorized(new { error = "Invalid username/email or password." });
            }

            var signInResult = await _signInManager.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: true);

            if(!signInResult.Succeeded)
            {
                return Unauthorized(new { error = "Invalid username/email or password." });
            }

            var roles = await _userManager.GetRolesAsync(user);

            var claims = new List<Claim>
            {
                new(JwtRegisteredClaimNames.Sub, user.Id),
                new(JwtRegisteredClaimNames.UniqueName, user.UserName?? string.Empty),
                new(JwtRegisteredClaimNames.Email, user.Email?? string.Empty),
                new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };

            claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));

            var issuer = _configuration["Jwt:Issuer"];
            var audience = _configuration["Jwt:Audience"];
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]!));

            var expiresAt = DateTime.UtcNow.AddHours(1);

            var token = new JwtSecurityToken(
                issuer: issuer,
                audience: audience,
                claims: claims,
                expires: expiresAt,
                signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256)
                );

            return Ok(new LoginResponse
            {
                Token = new JwtSecurityTokenHandler().WriteToken(token),
                ExpiresAt = expiresAt,
                UserId = user.Id,
                Username = user.UserName ?? string.Empty,
                Email = user.Email ?? string.Empty
            });
        }
    }
}

