import {
  ScanCommand,
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

export const handleProducts = async (
  method,
  event,
  response,
  docClient,
  tableGlobal,
  callback
) => {
  const tableName = "products";

  if (method === "GET") {
    try {
      let command;
      const queryStringParameters = event.queryStringParameters || {}; // Lấy tham số truy vấn

      if (queryStringParameters.id) {
        const { id } = queryStringParameters;
        // Tìm kiếm theo ID cụ thể
        command = new GetCommand({
          TableName: `${tableName}${tableGlobal}`,
          Key: {
            id,
          },
        });
      } else {
        // Lấy toàn bộ sản phẩm (không phân trang)
        command = new ScanCommand({
          TableName: `${tableName}${tableGlobal}`,
        });
      }

      const data = await docClient.send(command);
      response.body = JSON.stringify(
        queryStringParameters.id ? data.Item : data.Items
      );
    } catch (error) {
      console.error("Error processing GET request:", error);
      response.statusCode = 500;
      response.body = JSON.stringify({
        message: "Internal Server Error",
        error: error.message,
        status: false,
      });
    }
  } else if (method === "POST") {
    try {
      const requestBody = JSON.parse(event.body);
      const { id, name, price, quantity_in_stock, id_category } = requestBody;

      if (!id) {
        response.statusCode = 400;
        response.body = JSON.stringify({
          message: "Missing required fields",
          status: false,
        });
        callback(null, response);
        return;
      }

      const command = new PutCommand({
        TableName: `${tableName}${tableGlobal}`,
        Item: requestBody,
      });

      await docClient.send(command);
      response.body = JSON.stringify({
        message: "Product created successfully",
        status: true,
      });
    } catch (error) {
      console.error("Error processing POST request:", error);
      response.statusCode = 500;
      response.body = JSON.stringify({
        message: "Internal Server Error",
        error: error.message,
        status: false,
      });
    }
  } else if (method === "PUT") {
    try {
      const requestBody = JSON.parse(event.body);
      const { id } = requestBody;

      // Check if the required field 'id' is present
      if (!id) {
        response.statusCode = 400;
        response.body = JSON.stringify({
          message: "Missing required field: id",
          status: false,
        });
        callback(null, response);
        return;
      }

      // Prepare the update command
      const updateExpression = [];
      const expressionAttributeValues = {};

      // Loop through the request body to build the update expression
      for (const [key, value] of Object.entries(requestBody)) {
        if (key !== "id" && value !== undefined) {
          // Exclude 'id' and check for undefined values
          updateExpression.push(`${key} = :${key}`);
          expressionAttributeValues[`:${key}`] = value;
        }
      }

      if (updateExpression.length === 0) {
        response.statusCode = 400;
        response.body = JSON.stringify({
          message: "No fields to update",
          status: false,
        });
        callback(null, response);
        return;
      }

      const command = new UpdateCommand({
        TableName: `${tableName}${tableGlobal}`,
        Key: { id },
        UpdateExpression: `SET ${updateExpression.join(", ")}`,
        ExpressionAttributeValues: expressionAttributeValues,
      });

      await docClient.send(command);
      response.body = JSON.stringify({
        message: "Product updated successfully",
        status: true,
      });
    } catch (error) {
      console.error("Error processing PUT request:", error); // Log the error details
      response.statusCode = 500;
      response.body = JSON.stringify({
        message: "Internal Server Error",
        error: error.message,
        status: false,
      });
    }
  } else if (method === "DELETE") {
    try {
      const requestBody = JSON.parse(event.body);
      const { id } = requestBody;

      if (!id) {
        response.statusCode = 400;
        response.body = JSON.stringify({
          message: "Missing required fields id",
          status: false,
        });
        callback(null, response);
        return;
      }

      const command = new DeleteCommand({
        TableName: `${tableName}${tableGlobal}`,
        Key: { id },
      });

      await docClient.send(command);
      response.body = JSON.stringify({
        message: "Product deleted successfully",
        status: true,
      });
    } catch (error) {
      console.error("Error processing DELETE request:", error); // Log the error details
      response.statusCode = 500;
      response.body = JSON.stringify({
        message: "Internal Server Error",
        error: error.message,
        status: false,
      });
    }
  } else {
    response.statusCode = 405;
    response.body = JSON.stringify({
      message: "Method Not Allowed",
      status: false,
    });
  }
};

export const handleAddMultipleProducts = async (
  method,
  event,
  response,
  docClient,
  tableGlobal,
  callback
) => {
  const tableName = "products";

  if (method !== "POST") {
    response.statusCode = 405; // Method Not Allowed
    response.body = JSON.stringify({
      message: "Method not allowed",
      status: false,
    });
    return callback(null, response);
  }

  try {
    const requestBody = JSON.parse(event.body);
    const { items } = requestBody;

    if (!items || !Array.isArray(items) || items.length === 0) {
      response.statusCode = 400;
      response.body = JSON.stringify({
        message: "Missing required fields or items array is empty",
        status: false,
      });
      return callback(null, response);
    }

    const insertedItems = [];
    const existingProducts = [];

    for (const item of items) {
      const { id, name } = item;

      if (!id || !name) {
        response.statusCode = 400;
        response.body = JSON.stringify({
          message: "Missing required fields 'id', 'name'",
          status: false,
        });
        return callback(null, response);
      }

      // Sử dụng ScanCommand để kiểm tra trùng lặp dựa trên 'name'
      const scanCommand = new ScanCommand({
        TableName: `${tableName}${tableGlobal}`,
        FilterExpression: "#name = :name",
        ExpressionAttributeNames: {
          "#name": "name",
        },
        ExpressionAttributeValues: {
          ":name": name,
        },
      });

      const scanResponse = await docClient.send(scanCommand);

      if (scanResponse.Items.length > 0) {
        existingProducts.push(name);
        continue;
      }

      const putCommand = new PutCommand({
        TableName: `${tableName}${tableGlobal}`,
        Item: item,
      });

      await docClient.send(putCommand);
      insertedItems.push(item);
    }

    const scanAllCommand = new ScanCommand({
      TableName: `${tableName}${tableGlobal}`,
    });

    const scanResult = await docClient.send(scanAllCommand);

    response.body = JSON.stringify({
      message: "Products processed successfully",
      insertedItems,
      existingProducts:
        existingProducts.length > 0 ? existingProducts : undefined,
      allProducts: scanResult.Items,
      status: true,
    });
    response.statusCode = 201;
  } catch (error) {
    console.error("Error processing request:", error);
    response.statusCode = 500;
    response.body = JSON.stringify({
      message: "Internal Server Error",
      error: error.message,
      status: false,
    });
  }

  return callback(null, response);
};

export const handleGetProductsPaginations = async (
  method,
  event,
  response,
  docClient,
  tableGlobal,
  callback
) => {
  const tableName = "products"; // Your table name

  // Validate HTTP method
  if (method !== "GET") {
    response.statusCode = 405; // Method Not Allowed
    response.body = JSON.stringify({
      message: "Method not allowed",
      status: false,
    });
    return callback(null, response);
  }

  try {
    // Extract and validate query parameters
    const queryStringParameters = event.queryStringParameters || {};
    const limit = parseInt(queryStringParameters.limit || "10", 10); // Records per page
    const page = parseInt(queryStringParameters.page || "1", 10); // Current page

    if (limit <= 0 || page <= 0) {
      response.statusCode = 400; // Bad Request
      response.body = JSON.stringify({
        message: "Invalid pagination parameters",
        status: false,
      });
      return callback(null, response);
    }

    // Scan the table to get the total count of items
    const totalItemsCommand = new ScanCommand({
      TableName: `${tableName}${tableGlobal}`,
      Select: "COUNT", // Only count items, no data retrieval
    });

    const totalItemsResult = await docClient.send(totalItemsCommand);
    const totalItems = totalItemsResult.Count || 0;

    // Calculate the total number of pages
    const totalPages = Math.ceil(totalItems / limit);

    // Ensure the requested page is within bounds
    if (page > totalPages) {
      response.statusCode = 400; // Bad Request
      response.body = JSON.stringify({
        message: "Page number exceeds total pages",
        status: false,
      });
      return callback(null, response);
    }

    // Fetch items for the current page
    let items = [];
    let lastKey = null;
    const startIndex = (page - 1) * limit;
    let totalFetched = 0;

    while (totalFetched < startIndex) {
      const command = new ScanCommand({
        TableName: `${tableName}${tableGlobal}`,
        Limit: Math.min(limit, startIndex - totalFetched),
        ExclusiveStartKey: lastKey || undefined,
      });

      const data = await docClient.send(command);
      totalFetched += data.Items?.length || 0;
      lastKey = data.LastEvaluatedKey;

      if (!lastKey) break; // End of table
    }

    // Fetch the actual page data
    if (totalFetched >= startIndex || lastKey) {
      const command = new ScanCommand({
        TableName: `${tableName}${tableGlobal}`,
        Limit: limit,
        ExclusiveStartKey: lastKey || undefined,
      });

      const data = await docClient.send(command);
      items = data.Items || [];
      lastKey = data.LastEvaluatedKey || null;
    }

    // Return paginated response with total pages
    response.statusCode = 200;
    response.body = JSON.stringify({
      items,
      page,
      limit,
      totalPages,
      totalItems,
      lastKey: lastKey ? encodeURIComponent(JSON.stringify(lastKey)) : null,
      status: true,
    });
  } catch (error) {
    console.error("Error processing request:", error.message);
    response.statusCode = 500;
    response.body = JSON.stringify({
      message: "Internal Server Error",
      error: error.message,
      status: false,
    });
  }

  return callback(null, response);
};
