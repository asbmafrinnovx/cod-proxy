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
  const STOREFRONT_TOKEN = '662909a9ab3c75cb682824255fba7522';

  try {
    const { name, phone, address, city, variantId, note } = req.body;

    if (!name || !phone || !address || !variantId) {
      res.status(400).json({ error: 'Champs manquants' });
      return;
    }

    const firstName = name.split(' ')[0];
    const lastName  = name.split(' ').slice(1).join(' ') || '.';
    const cleanPhone = phone.replace(/\D/g, '');
    const fakeEmail = 'cod' + cleanPhone + '@gmail.com';

    const mutation = `
      mutation cartCreate($input: CartInput!) {
        cartCreate(input: $input) {
          cart {
            id
            checkoutUrl
          }
          userErrors { field message }
        }
      }`;

    const variables = {
      input: {
        lines: [{
          merchandiseId: 'gid://shopify/ProductVariant/' + variantId,
          quantity: 1
        }],
        buyerIdentity: {
          email: fakeEmail,
          phone: phone,
          countryCode: 'MA',
          deliveryAddressPreferences: [{
            deliveryAddress: {
              firstName,
              lastName,
              address1: address,
              city: city || address,
              country: 'Morocco',
              phone: phone
            }
          }]
        },
        note: 'CLIENT: ' + name + ' | TEL: ' + phone + ' | VILLE: ' + (city || '') + ' | ADRESSE: ' + address + (note ? ' | NOTE: ' + note : ''),
        attributes: [
          { key: 'Telephone', value: phone },
          { key: 'Nom', value: name },
          { key: 'Ville', value: city || '' },
          { key: 'Methode de paiement', value: 'Cash on Delivery' }
        ]
      }
    };

    const shopifyResp = await fetch(`https://${SHOP}/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN
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
        body: responseText.substring(0, 500)
      });
      return;
    }

    if (data.errors) {
      res.status(500).json({
        error: 'Shopify error: ' + JSON.stringify(data.errors),
        details: data.errors
      });
      return;
    }

    const result = data.data && data.data.cartCreate;

    if (result && result.userErrors && result.userErrors.length > 0) {
      res.status(400).json({ error: result.userErrors[0].message });
      return;
    }

    if (result && result.cart) {
      res.status(200).json({
        success: true,
        checkoutUrl: result.cart.checkoutUrl,
        cartId: result.cart.id
      });
      return;
    }

    res.status(500).json({
      error: 'Reponse inattendue: ' + JSON.stringify(data).substring(0, 300)
    });

  } catch (err) {
    res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
}
