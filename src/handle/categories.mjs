import {
  ScanCommand,
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

export const handleCategories = async (
  method,
  event,
  response,
  docClient,
  tableGlobal,
  callback
) => {
  const tableName = "categories";

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
      } else if (queryStringParameters.type) {
        const { type } = queryStringParameters;
        // Tìm kiếm danh mục theo `type`
        command = new ScanCommand({
          TableName: `${tableName}${tableGlobal}`,
          FilterExpression: "#type = :typeValue",
          ExpressionAttributeNames: {
            "#type": "type",
          },
          ExpressionAttributeValues: {
            ":typeValue": Number(type),
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
      message: "Category created successfully",
      data: data.Item,
    });
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
        message: "Category updated successfully",
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
  } else {
    response.statusCode = 405;
    response.body = JSON.stringify({
      message: "Method Not Allowed",
      status: false,
    });
  }
};

export const handleAddMultipleCategories = async (
  method,
  event,
  response,
  docClient,
  tableGlobal,
  callback
) => {
  const tableName = "categories";

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
    const existingCategories = [];

    for (const item of items) {
      const { id, name, type } = item;

      if (!id || !name || type === undefined) {
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
        existingCategories.push(name);
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
      message: "Categories processed successfully",
      insertedItems,
      existingCategories:
        existingCategories.length > 0 ? existingCategories : undefined,
      allCategories: scanResult.Items,
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
