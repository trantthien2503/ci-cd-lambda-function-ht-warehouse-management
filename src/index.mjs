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
    const handlers = {
      "/categories": handleCategories,
      "/categories/add-multiple": handleAddMultipleCategories,
      "/units": handleUnits,
      "/stocks": handleStocks,
      "/products": handleProducts,
      "/products/add-multiple": handleAddMultipleProducts,
      "/products/get-paginations": handleGetProductsPaginations,
      "/warehouse-location": handleWarehouseLocation,
      "/suppliers": handleSupplier,
      "/suppliers/add-multiple": handleAddMultipleSuppliers,
      "/bills": handleBills,
      "/bills/suppliers": handleBillSuppliers,
    };

    if (handlers[path]) {
      await handlers[path](
        method,
        event,
        response,
        docClient,
        tableGlobal,
        callback
      );
    } else {
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
