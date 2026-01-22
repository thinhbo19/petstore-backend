function renderSwaggerHome(mergedTags) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>PetStore API Documentation</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background: linear-gradient(135deg, #FFB75E 0%, #ED8F03 100%);
          min-height: 100vh;
          padding: 40px 20px;
        }
        .container {
          max-width: 1200px;
          margin: 0 auto;
        }
        .header {
          text-align: center;
          color: white;
          margin-bottom: 50px;
        }
        .header h1 {
          font-size: 3rem;
          margin-bottom: 10px;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }
        .header p {
          font-size: 1.2rem;
          opacity: 0.9;
        }
        .tags-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
          margin-top: 30px;
        }
        .tag-card {
          background: white;
          border-radius: 12px;
          padding: 25px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
          cursor: pointer;
          text-decoration: none;
          color: inherit;
          display: block;
        }
        .tag-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 8px 15px rgba(0,0,0,0.2);
        }
        .tag-card h2 {
          color: #FF9800;
          font-size: 1.5rem;
          margin-bottom: 10px;
        }
        .tag-card p {
          color: #666;
          font-size: 0.95rem;
          line-height: 1.5;
        }
        .footer {
          text-align: center;
          color: white;
          margin-top: 50px;
          opacity: 0.8;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🐾 PetStore API Documentation</h1>
          <p>Chọn một module để xem chi tiết API</p>
        </div>
        <div class="tags-grid">
          ${mergedTags
            .map(
              (tag) => `
            <a href="/api-docs/${tag.name}" class="tag-card">
              <h2>${tag.name}</h2>
              <p>${tag.description || "API documentation"}</p>
            </a>
          `
            )
            .join("")}
        </div>
        <div class="footer">
          <p>PetStore Backend API v1.0.0</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

module.exports = { renderSwaggerHome };


