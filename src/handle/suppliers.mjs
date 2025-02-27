import {
  ScanCommand,
  GetCommand,
  PutCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

export const handleSupplier = async (
  method,
  event,
  response,
  docClient,
  tableGlobal,
  callback
) => {
  const tableName = "suppliers";

  if (method === "GET") {
    try {
      let command;
      const queryStringParameters = event.queryStringParameters || {}; // Lấy tham số truy vấn

      if (queryStringParameters.id) {
        const { id } = queryStringParameters;
        // Tìm kiếm danh mục theo `type`
        command = new ScanCommand({
          TableName: `${tableName}${tableGlobal}`,
          FilterExpression: "#id = :typeValue",
          ExpressionAttributeNames: {
            "#id": "id",
          },
          ExpressionAttributeValues: {
            ":typeValue": id,
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
    // Parse the request body
    const requestBody = JSON.parse(event.body);
    const { id } = requestBody;

    // Check if 'id' is missing in the request body
    if (!id) {
      response.statusCode = 400;
      response.body = JSON.stringify({ message: "Missing required fields" });
      return callback(null, response);
    }

    // PutCommand to insert the item into DynamoDB
    const putCommand = new PutCommand({
      TableName: `${tableName}${tableGlobal}`,
      Item: requestBody,
    });

    await docClient.send(putCommand);

    // GetCommand to fetch the item just inserted
    const getCommand = new GetCommand({
      TableName: `${tableName}${tableGlobal}`,
      Key: { id },
    });

    const data = await docClient.send(getCommand);

    // Set success response
    response.body = JSON.stringify({
      message: "Supplier created successfully",
      data: data.Item,
    });
  } else if (method === "PUT") {
  } else if (method === "DELETE") {
    const requestBody = JSON.parse(event.body);
    const { id } = requestBody;

    if (!id) {
      response.statusCode = 400;
      response.body = JSON.stringify({ message: "Missing required fields id" });
      callback(null, response);
      return;
    }

    const command = new DeleteCommand({
      TableName: `${tableName}${tableGlobal}`,
      Key: { id },
    });

    await docClient.send(command);
    response.body = JSON.stringify({
      message: "Supplier deleted successfully",
    });
  } else {
    response.statusCode = 405;
    response.body = JSON.stringify({ message: "Method Not Allowed" });
  }
};

export const handleAddMultipleSuppliers = async (
  method,
  event,
  response,
  docClient,
  tableGlobal,
  callback
) => {
  const tableName = "suppliers";

  if (method !== "POST") {
    response.statusCode = 405; // Method Not Allowed
    response.body = JSON.stringify({ message: "Method not allowed" });
    return callback(null, response);
  }

  try {
    const requestBody = JSON.parse(event.body);
    const { items } = requestBody;

    if (!items || !Array.isArray(items) || items.length === 0) {
      response.statusCode = 400;
      response.body = JSON.stringify({
        message: "Missing required fields or items array is empty",
      });
      return callback(null, response);
    }

    const insertedItems = [];
    const existingSuppliers = [];

    for (const item of items) {
      const { id, name } = item;

      if (!id || !name) {
        response.statusCode = 400;
        response.body = JSON.stringify({
          message: "Missing required fields 'id', 'name', or 'type'",
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
        existingSuppliers.push(name);
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
      message: "Suppliers processed successfully",
      insertedItems,
      existingSuppliers:
        existingSuppliers.length > 0 ? existingSuppliers : undefined,
      allSuppliers: scanResult.Items,
    });
    response.statusCode = 201;
  } catch (error) {
    console.error("Error processing request:", error);
    response.statusCode = 500;
    response.body = JSON.stringify({
      message: "Internal Server Error",
      error: error.message,
    });
  }

  return callback(null, response);
};
