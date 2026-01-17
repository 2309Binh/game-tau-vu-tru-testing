using backend.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend",
        policy => policy
            .AllowAnyOrigin()
            .AllowAnyHeader()
            .AllowAnyMethod());
});

builder.Services.AddControllers();

builder.Services.AddDbContext<GameDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<GameDbContext>();

    var retries = 10;
    var delay = TimeSpan.FromSeconds(2);

    while (true)
    {
        try
        {
            await db.Database.MigrateAsync(); // erstellt/updated Schema automatisch
            break;
        }
        catch (Exception ex) when (retries-- > 0)
        {
            Console.WriteLine($"DB not ready yet, retrying... {ex.Message}");
            await Task.Delay(delay);
        }
    }
}

app.UseCors("AllowFrontend");

app.MapControllers();

app.UseSwagger();
app.UseSwaggerUI();

app.Run();

