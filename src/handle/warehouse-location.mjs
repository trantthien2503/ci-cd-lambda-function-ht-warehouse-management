import {
  ScanCommand,
  GetCommand,
  PutCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

export const handleWarehouseLocation = async (
  method,
  event,
  response,
  docClient,
  tableGlobal,
  callback
) => {
  const tableName = "warehouse-location";

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
      console.error("Error processing request:", error);
      response.statusCode = 500;
      response.body = JSON.stringify({
        message: "Internal Server Error",
        error: error.message,
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
      message: "Warehouse location created successfully",
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
      message: "Warehouse Location deleted successfully",
    });
  } else {
    response.statusCode = 405;
    response.body = JSON.stringify({ message: "Method Not Allowed" });
  }
};
