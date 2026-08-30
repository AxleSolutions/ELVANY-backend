import dotenv from 'dotenv';
dotenv.config();

import { supabase, isSupabaseReady } from './src/config/supabase.js';

const SEED_PRODUCTS = [
  {
    sku: 'ELV-TEE-001',
    slug: 'florentine-heavyweight-tee',
    title: 'The Florentine Heavyweight T-Shirt',
    subtitle: '300 GSM Noble Suvin Cotton • High Double-Ribbed Collar',
    category: 'heavyweight-tees',
    silhouette: 'Relaxed Tailored Architecture',
    fabric_composition: '100% Suvin Cotton (Rare Long-Staple)',
    fabric_weight: '300 GSM',
    description: 'The definitive foundation of modern masculine tailoring. Engineered from ultra-rare 300 GSM Suvin cotton, this silhouette features a non-sagging high ribbed neckline and zero shoulder drop.',
    craftsmanship_details: [
      '300 GSM Heavyweight Suvin Cotton',
      'Dual-Reinforced Neckband (Zero stretch over time)',
      'Blind-Stitched Hemlines & Cuffs',
      'Pre-shrunk at the atelier'
    ],
    care_instructions: [
      'Machine wash gentle cold (30°C)',
      'Lay flat to dry away from direct sunlight',
      'Warm iron with garment parchment'
    ],
    base_price_lkr: 18500,
    original_price_lkr: 22000,
    is_offer_applied: true,
    is_active: true,
    is_featured: true,
    variants: [
      {
        color_name: 'Onyx Black',
        color_hex: '#141518',
        is_default: true,
        gallery_images: [
          '/images/hero_tshirt.jpg',
          '/images/model_tshirt.jpg',
          '/images/craft_canvas.jpg'
        ],
        sizes: [
          { size_code: 'S (38)', stock_quantity: 14, chest_measure_cm: 104, length_measure_cm: 71 },
          { size_code: 'M (40)', stock_quantity: 28, chest_measure_cm: 110, length_measure_cm: 73 },
          { size_code: 'L (42)', stock_quantity: 32, chest_measure_cm: 116, length_measure_cm: 75 },
          { size_code: 'XL (44)', stock_quantity: 18, chest_measure_cm: 122, length_measure_cm: 77 },
          { size_code: 'XXL (46)', stock_quantity: 8, chest_measure_cm: 128, length_measure_cm: 79 }
        ]
      },
      {
        color_name: 'Optical White',
        color_hex: '#f5f5f7',
        is_default: false,
        gallery_images: [
          '/images/tshirt_white.jpg',
          '/images/craft_canvas.jpg'
        ],
        sizes: [
          { size_code: 'S (38)', stock_quantity: 10, chest_measure_cm: 104, length_measure_cm: 71 },
          { size_code: 'M (40)', stock_quantity: 22, chest_measure_cm: 110, length_measure_cm: 73 },
          { size_code: 'L (42)', stock_quantity: 25, chest_measure_cm: 116, length_measure_cm: 75 },
          { size_code: 'XL (44)', stock_quantity: 15, chest_measure_cm: 122, length_measure_cm: 77 }
        ]
      }
    ]
  },
  {
    sku: 'ELV-TEE-002',
    slug: 'monarch-oversized-structured-tee',
    title: 'The Monarch Oversized Heavyweight Tee',
    subtitle: '340 GSM Giza 87 Egyptian Cotton • Drop-Shoulder Vault',
    category: 'heavyweight-tees',
    silhouette: 'Sculptural Box Cut',
    fabric_composition: '100% Giza 87 Egyptian Cotton',
    fabric_weight: '340 GSM',
    description: 'An architectural statement piece offering supreme drape and weight. Woven from 340 GSM Giza 87 yarns for structural rigidity without sacrificing softness.',
    craftsmanship_details: [
      '340 GSM Structured Egyptian Cotton',
      'Architectural Box Silhouette',
      'Double-Needle Flatlock Seams'
    ],
    care_instructions: [
      'Machine wash cold gentle cycle',
      'Do not tumble dry'
    ],
    base_price_lkr: 21500,
    original_price_lkr: 24500,
    is_offer_applied: false,
    is_active: true,
    is_featured: true,
    variants: [
      {
        color_name: 'Florentine Gold',
        color_hex: '#c5a059',
        is_default: true,
        gallery_images: [
          '/images/pillar_knitwear.jpg',
          '/images/craft_canvas.jpg'
        ],
        sizes: [
          { size_code: 'M (40)', stock_quantity: 19, chest_measure_cm: 114, length_measure_cm: 74 },
          { size_code: 'L (42)', stock_quantity: 24, chest_measure_cm: 120, length_measure_cm: 76 },
          { size_code: 'XL (44)', stock_quantity: 12, chest_measure_cm: 126, length_measure_cm: 78 }
        ]
      }
    ]
  }
];

async function seed() {
  if (!isSupabaseReady) {
    console.log('❌ Supabase not ready.');
    return;
  }

  console.log('Seeding Supabase catalog data...');

  for (const prod of SEED_PRODUCTS) {
    const { data: insertedProd, error: prodErr } = await supabase
      .from('products')
      .upsert({
        sku: prod.sku,
        slug: prod.slug,
        title: prod.title,
        subtitle: prod.subtitle,
        category: prod.category,
        silhouette: prod.silhouette,
        fabric_composition: prod.fabric_composition,
        fabric_weight: prod.fabric_weight,
        description: prod.description,
        craftsmanship_details: prod.craftsmanship_details,
        care_instructions: prod.care_instructions,
        base_price_lkr: prod.base_price_lkr,
        original_price_lkr: prod.original_price_lkr,
        is_offer_applied: prod.is_offer_applied,
        is_active: prod.is_active,
        is_featured: prod.is_featured
      }, { onConflict: 'sku' })
      .select()
      .single();

    if (prodErr) {
      console.error('Error seeding product:', prod.title, prodErr.message);
      continue;
    }

    console.log(`✓ Product seeded: ${insertedProd.title}`);

    for (const variant of prod.variants) {
      const { data: insertedVar, error: varErr } = await supabase
        .from('product_variants')
        .insert({
          product_id: insertedProd.id,
          color_name: variant.color_name,
          color_hex: variant.color_hex,
          gallery_images: variant.gallery_images,
          is_default: variant.is_default
        })
        .select()
        .single();

      if (varErr) {
        console.error('  Error seeding variant:', variant.color_name, varErr.message);
        continue;
      }

      console.log(`  ✓ Colorway variant seeded: ${variant.color_name}`);

      const stockRows = variant.sizes.map((s) => ({
        variant_id: insertedVar.id,
        size_code: s.size_code,
        stock_quantity: s.stock_quantity,
        chest_measure_cm: s.chest_measure_cm,
        length_measure_cm: s.length_measure_cm
      }));

      const { error: stockErr } = await supabase
        .from('product_stock')
        .insert(stockRows);

      if (stockErr) {
        console.error('    Error seeding stock matrix:', stockErr.message);
      } else {
        console.log(`    ✓ Stock inventory matrix seeded (${stockRows.length} sizes)`);
      }
    }
  }

  // Seed sample promotions
  await supabase.from('promotions').upsert({
    code: 'ATELIER-3000',
    title: 'Special Atelier Privilege: Save LKR 3,000',
    badge_label: 'SPECIAL ATELIER PRIVILEGE: SAVE LKR 3,000',
    discount_type: 'fixed_amount',
    discount_value: 3000,
    min_order_amount_lkr: 15000,
    is_active: true
  }, { onConflict: 'code' });

  console.log('✓ Privilege Promotions seeded.');
  console.log('\n🎉 ALL SUPABASE SEED DATA GENERATED SUCCESSFULLY!\n');
}

seed();
