import {
  ScanCommand,
  GetCommand,
  PutCommand,
  DeleteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

export const handleBills = async (
  method,
  event,
  response,
  docClient,
  tableGlobal,
  callback
) => {
  const tableName = `bills${tableGlobal}`;

  if (method === "GET") {
    try {
      let command;
      const queryStringParameters = event.queryStringParameters || {}; // Lấy tham số truy vấn

      if (queryStringParameters.id) {
        const { id } = queryStringParameters;
        // Tìm kiếm theo ID cụ thể
        command = new GetCommand({
          TableName: tableName,
          Key: {
            id,
          },
        });
      } else {
        // Lấy toàn bộ sản phẩm (không phân trang)
        command = new ScanCommand({
          TableName: tableName,
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
        TableName: tableName,
        Item: requestBody,
      });

      await docClient.send(putCommand);

      // GetCommand to fetch the item just inserted
      const getCommand = new GetCommand({
        TableName: tableName,
        Key: { id: id }, // Đảm bảo Key có đúng định dạng
      });

      const data = await docClient.send(getCommand);

      // Set success response
      response.body = JSON.stringify({
        message: "Bill created successfully",
        data: data.Item,
      });
    } catch (error) {
      console.error("Error:", error);

      // Set error response
      response.statusCode = 500;
      response.body = JSON.stringify({
        message: "Internal server error",
        error: error.message, // Trả về thông báo lỗi chi tiết
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
      const expressionAttributeNames = {}; // Thêm ExpressionAttributeNames để tránh từ khóa bị cấm

      // Loop through the request body to build the update expression
      for (const [key, value] of Object.entries(requestBody)) {
        if (key !== "id" && value !== undefined) {
          // Exclude 'id' and check for undefined values
          let attributeName = key;

          // Kiểm tra nếu key là từ khóa bị cấm
          if (key === "status") {
            attributeName = "#status"; // Định danh thay thế
            expressionAttributeNames["#status"] = "status"; // Ánh xạ tên thực tế
          }

          updateExpression.push(`${attributeName} = :${key}`);
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
        TableName: tableName,
        Key: { id },
        UpdateExpression: `SET ${updateExpression.join(", ")}`,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames:
          Object.keys(expressionAttributeNames).length > 0
            ? expressionAttributeNames
            : undefined,
      });

      await docClient.send(command);
      response.body = JSON.stringify({
        message: "Bill updated successfully",
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
        TableName: tableName,
        Key: { id },
      });

      await docClient.send(command);
      response.body = JSON.stringify({
        message: "Bill deleted successfully",
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

export const handleBillSuppliers = async (
  method,
  event,
  response,
  docClient,
  tableGlobal,
  callback
) => {
  const tableBill = `bills${tableGlobal}`;
  const tableSuppliers = `suppliers${tableGlobal}`;

  if (method === "GET") {
    try {
      // Lấy tất cả hóa đơn
      const commandBill = new ScanCommand({ TableName: tableBill });
      const commandSupplier = new ScanCommand({ TableName: tableSuppliers });

      const [billsData, suppliersData] = await Promise.all([
        docClient.send(commandBill),
        docClient.send(commandSupplier),
      ]);

      // Lấy danh sách supplierId đã xuất hiện trong bills
      const supplierIdsInBills = new Set(
        billsData.Items?.map((bill) => bill.supplierId)
      );

      // Lọc danh sách suppliers, chỉ giữ lại những supplierId có trong bills
      const filteredSuppliers = suppliersData.Items?.filter((supplier) =>
        supplierIdsInBills.has(supplier.supplierId)
      );

      response.body = JSON.stringify({
        suppliers: filteredSuppliers || [],
      });
    } catch (error) {
      console.error("Error processing GET request:", error);
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
