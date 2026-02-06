/**
 * @On(event = "linkGeneration", entity = "Tokens")
 */
async function linkGeneration(context) {
  const { Buyers, Order, Tokens } = cds.entities;

  // Extract the authenticated user ID and orderID from the context
  const userId = context.user.id;
  const { orderID } = context.data;

  // Ensure userId and orderID are defined
  if (!userId || !orderID) {
    context.reject(400, "User ID and Order ID are required.");
    return;
  }

  // Check if the order exists
  const order = await SELECT.one.from(Order).where({ ID: orderID });
  if (!order) {
    context.reject(404, "Order not found.");
    return;
  }

  // Check if the user exists
  const buyer = await SELECT.one.from(Buyers).where({ ID: userId });
  if (!buyer) {
    context.reject(404, "Buyer not found.");
    return;
  }

  // Generate the token using the generateToken function
  const token = await this.generateToken({ purchaseId: orderID });
  if (!token) {
    context.reject(500, "Failed to generate token.");
    return;
  }

  // Prepare the new token record
  const newToken = {
    token,
    created_by_ID: userId,
    orderID_ID: orderID,
    expires_at: new Date(Date.now() + 42 * 60 * 60 * 1000), // 42 hours in the future
    revoked: false,
    linkInUse: false,
    lastUsed_at: null
  };

  // Insert the new token record into the Tokens entity
  await INSERT.into(Tokens).columns(
    'token', 'created_by_ID', 'orderID_ID', 'expires_at', 'revoked', 'linkInUse', 'lastUsed_at'
  ).values(
    newToken.token, newToken.created_by_ID, newToken.orderID_ID, newToken.expires_at, newToken.revoked, newToken.linkInUse, newToken.lastUsed_at
  );

  // Return the generated token
  return token;
}