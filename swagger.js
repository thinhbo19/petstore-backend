const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

// Hàm đọc đệ quy tất cả file YAML trong thư mục và các thư mục con
function readYamlFilesRecursive(dir, mergedPaths = {}, mergedTags = []) {
  if (!fs.existsSync(dir)) {
    return { mergedPaths, mergedTags };
  }

  const items = fs.readdirSync(dir, { withFileTypes: true });

  items.forEach((item) => {
    const fullPath = path.join(dir, item.name);

    if (item.isDirectory()) {
      // Đọc đệ quy vào thư mục con
      const result = readYamlFilesRecursive(fullPath, mergedPaths, mergedTags);
      mergedPaths = result.mergedPaths;
      mergedTags = result.mergedTags;
    } else if (item.isFile() && (item.name.endsWith(".yaml") || item.name.endsWith(".yml"))) {
      // Đọc file YAML
      const fileContent = fs.readFileSync(fullPath, "utf8");
      const yamlContent = yaml.load(fileContent);

      // Merge paths
      if (yamlContent.paths) {
        mergedPaths = { ...mergedPaths, ...yamlContent.paths };
      }

      // Merge tags (chỉ lấy unique tags)
      if (yamlContent.tags) {
        yamlContent.tags.forEach((tag) => {
          if (!mergedTags.find((t) => t.name === tag.name)) {
            mergedTags.push(tag);
          }
        });
      }
    }
  });

  return { mergedPaths, mergedTags };
}

// Đọc và merge tất cả các file YAML
const definitionsDir = path.join(__dirname, "swagger", "definitions");
const { mergedPaths, mergedTags } = readYamlFilesRecursive(definitionsDir);

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "PetStore Backend API",
      version: "1.0.0",
      description:
        "Tài liệu API cho hệ thống PetStore (Users, Pets, Products, Orders, Booking, v.v.)",
    },
    servers: [
      {
        url: "http://localhost:8888",
        description: "Local server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    tags: mergedTags,
    paths: mergedPaths,
  },
  apis: [], // Không cần đọc từ router.js nữa vì đã có YAML
};

const swaggerSpec = swaggerJsdoc(options);

// Hàm tạo swagger spec cho một tag cụ thể
function getSwaggerSpecByTag(tagName) {
  // Filter paths chỉ giữ lại những path có tag tương ứng
  const filteredPaths = {};
  Object.keys(mergedPaths).forEach((path) => {
    const pathObj = mergedPaths[path];
    Object.keys(pathObj).forEach((method) => {
      const methodObj = pathObj[method];
      if (methodObj.tags && methodObj.tags.includes(tagName)) {
        if (!filteredPaths[path]) {
          filteredPaths[path] = {};
        }
        filteredPaths[path][method] = methodObj;
      }
    });
  });

  // Tìm tag info
  const tagInfo = mergedTags.find((t) => t.name === tagName);

  const tagOptions = {
    definition: {
      openapi: "3.0.0",
      info: {
        title: `${tagInfo ? tagInfo.name : tagName} API`,
        version: "1.0.0",
        description: tagInfo ? tagInfo.description : `API documentation for ${tagName}`,
      },
      servers: [
        {
          url: "http://localhost:8888",
          description: "Local server",
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
      tags: tagInfo ? [tagInfo] : [{ name: tagName }],
      paths: filteredPaths,
    },
    apis: [],
  };

  return swaggerJsdoc(tagOptions);
}

module.exports = {
  swaggerUi,
  swaggerSpec,
  mergedTags,
  getSwaggerSpecByTag,
};
