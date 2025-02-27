import { docClient } from "./dynamoDBClient.mjs";
import {
  handleCategories,
  handleAddMultipleCategories,
} from "./handle/categories.mjs";
import {
  handleProducts,
  handleAddMultipleProducts,
  handleGetProductsPaginations,
} from "./handle/products.mjs";
import { handleWarehouseLocation } from "./handle/warehouse-location.mjs";
import {
  handleSupplier,
  handleAddMultipleSuppliers,
} from "./handle/suppliers.mjs";
import { handleBills, handleBillSuppliers } from "./handle/bills.mjs";
import { handleUnits } from "./handle/units.mjs";
import { handleStocks } from "./handle/stocks.mjs";

const tableGlobal = "__hoangthien-warehouse-management";

export const handler = async function (event, context, callback) {
  const path = event.path;
  const method = event.httpMethod;
  const response = {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: null,
  };

  try {
    switch (path) {
      case "/connection":
        response.body = JSON.stringify({
          data: true,
          message: "Connection successful",
        });
        callback(null, response);
        break;
      // Router categories
      case "/categories":
        await handleCategories(
          method,
          event,
          response,
          docClient,
          tableGlobal,
          callback
        );
        break;
      case "/categories/add-multiple":
        await handleAddMultipleCategories(
          method,
          event,
          response,
          docClient,
          tableGlobal,
          callback
        );
        break;
      case "/units":
        await handleUnits(
          method,
          event,
          response,
          docClient,
          tableGlobal,
          callback
        );
        break;

      case "/stocks":
        await handleStocks(
          method,
          event,
          response,
          docClient,
          tableGlobal,
          callback
        );
        break;
      // Router products
      case "/products":
        await handleProducts(
          method,
          event,
          response,
          docClient,
          tableGlobal,
          callback
        );
        break;
      case "/products/add-multiple":
        await handleAddMultipleProducts(
          method,
          event,
          response,
          docClient,
          tableGlobal,
          callback
        );
        break;
      case "/products/get-paginations":
        await handleGetProductsPaginations(
          method,
          event,
          response,
          docClient,
          tableGlobal,
          callback
        );
        break;
      // Router warehouse-location
      case "/warehouse-location":
        await handleWarehouseLocation(
          method,
          event,
          response,
          docClient,
          tableGlobal,
          callback
        );
        break;
      // Router suppliers
      case "/suppliers":
        await handleSupplier(
          method,
          event,
          response,
          docClient,
          tableGlobal,
          callback
        );
        break;
      case "/suppliers/add-multiple":
        await handleAddMultipleSuppliers(
          method,
          event,
          response,
          docClient,
          tableGlobal,
          callback
        );
        break;
      // Router employees
      case "/employees":
        if (method === "GET") {
          response.body = JSON.stringify({ message: "employees GET" });
        } else if (method === "POST") {
          response.body = JSON.stringify({ message: "employees POST" });
        }
        break;
      // Router bills
      case "/bills":
        await handleBills(
          method,
          event,
          response,
          docClient,
          tableGlobal,
          callback
        );
        break;
      case "/bills/suppliers":
        await handleBillSuppliers(
          method,
          event,
          response,
          docClient,
          tableGlobal,
          callback
        );
        break;
      default:
        response.statusCode = 404;
        response.body = JSON.stringify({ message: "Not Found" });
    }
  } catch (error) {
    console.error("Error handling request:", error);
    response.statusCode = 500;
    response.body = JSON.stringify({ message: "Internal Server Error" });
  }

  callback(null, response);
};
