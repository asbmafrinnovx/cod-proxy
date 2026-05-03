export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const SHOP  = 'm0tbd5-jp.myshopify.com';
  const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;

  if (!TOKEN) {
    res.status(500).json({ error: 'Token manquant dans Vercel' });
    return;
  }

  try {
    const { name, phone, address, city, variantId, note } = req.body;

    if (!name || !phone || !address || !variantId) {
      res.status(400).json({ error: 'Champs manquants', received: { name, phone, address, variantId } });
      return;
    }

    const firstName = name.split(' ')[0];
    const lastName  = name.split(' ').slice(1).join(' ') || '.';
    const fakeEmail = phone.replace(/\D/g, '') + '@cod.tawbahijabi.ma';

    const mutation = `
      mutation draftOrderCreate($input: DraftOrderInput!) {
        draftOrderCreate(input: $input) {
          draftOrder { id name legacyResourceId }
          userErrors { field message }
        }
      }`;

    const variables = {
      input: {
        lineItems: [{
          variantId: 'gid://shopify/ProductVariant/' + variantId,
          quantity: 1
        }],
        email: fakeEmail,
        shippingAddress: {
          firstName,
          lastName,
          address1: address,
          city: city || address,
          countryCode: 'MA',
          phone
        },
        billingAddress: {
          firstName,
          lastName,
          address1: address,
          city: city || address,
          countryCode: 'MA',
          phone
        },
        note: 'TEL: ' + phone + ' | NOM: ' + name + ' | VILLE: ' + (city || '') + (note ? ' | NOTE: ' + note : ''),
        tags: 'COD,telephone',
        customAttributes: [
          { key: 'Telephone', value: phone },
          { key: 'Methode', value: 'Cash on Delivery' }
        ]
      }
    };

    const shopifyResp = await fetch(`https://${SHOP}/admin/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': TOKEN
      },
      body: JSON.stringify({ query: mutation, variables })
    });

    const responseText = await shopifyResp.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      res.status(500).json({
        error: 'Reponse Shopify invalide',
        status: shopifyResp.status,
        body: responseText.substring(0, 500)
      });
      return;
    }

    if (data.errors) {
      res.status(500).json({
        error: 'Shopify GraphQL error: ' + JSON.stringify(data.errors),
        details: data.errors,
        status: shopifyResp.status
      });
      return;
    }

    const result = data.data && data.data.draftOrderCreate;

    if (result && result.userErrors && result.userErrors.length > 0) {
      res.status(400).json({ error: result.userErrors[0].message, allErrors: result.userErrors });
      return;
    }

    if (result && result.draftOrder) {
      res.status(200).json({
        success: true,
        orderName: result.draftOrder.name,
        orderId: result.draftOrder.legacyResourceId
      });
      return;
    }

    res.status(500).json({
      error: 'Reponse inattendue: ' + JSON.stringify(data).substring(0, 300),
      fullResponse: data,
      status: shopifyResp.status
    });

  } catch (err) {
    res.status(500).json({ error: err.message || 'Erreur serveur', stack: err.stack });
  }
}
