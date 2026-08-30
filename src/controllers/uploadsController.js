import { cloudinary, isCloudinaryReady } from '../config/cloudinary.js';

/**
 * Upload bank transfer slip or garment image to Cloudinary
 */
export async function uploadSlip(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file attached for upload.'
      });
    }

    const { orderCode } = req.body;

    if (!isCloudinaryReady) {
      // In development mode fallback: return data URI
      const base64 = req.file.buffer.toString('base64');
      const dataUri = `data:${req.file.mimetype};base64,${base64}`;

      return res.status(200).json({
        success: true,
        message: 'File processed in development fallback mode.',
        data: {
          url: dataUri,
          public_id: `local_${Date.now()}`,
          format: req.file.mimetype.split('/')[1] || 'png',
          fileName: req.file.originalname
        }
      });
    }

    // Stream buffer to Cloudinary
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'elvany/payment_slips',
        tags: orderCode ? [`order_${orderCode}`, 'payment_slip'] : ['payment_slip'],
        resource_type: req.file.mimetype === 'application/pdf' ? 'raw' : 'image'
      },
      (error, result) => {
        if (error) {
          return next(error);
        }

        res.status(200).json({
          success: true,
          message: 'Payment slip securely archived in Cloudinary.',
          data: {
            url: result.secure_url,
            public_id: result.public_id,
            format: result.format,
            bytes: result.bytes,
            fileName: req.file.originalname
          }
        });
      }
    );

    uploadStream.end(req.file.buffer);
  } catch (err) {
    next(err);
  }
}

export async function uploadProductImage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No garment image file attached for upload.'
      });
    }

    if (!isCloudinaryReady) {
      const base64 = req.file.buffer.toString('base64');
      const dataUri = `data:${req.file.mimetype};base64,${base64}`;

      return res.status(200).json({
        success: true,
        message: 'Image processed in development mode.',
        data: {
          url: dataUri,
          public_id: `local_${Date.now()}`,
          format: req.file.mimetype.split('/')[1] || 'jpg',
          fileName: req.file.originalname
        }
      });
    }

    // Stream image buffer to Cloudinary in 'elvany/products' folder
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'elvany/products',
        tags: ['elvany_garment', 'product_image'],
        resource_type: 'image'
      },
      (error, result) => {
        if (error) {
          return next(error);
        }

        res.status(200).json({
          success: true,
          message: 'Garment image successfully uploaded to Cloudinary CDN.',
          data: {
            url: result.secure_url,
            public_id: result.public_id,
            format: result.format,
            bytes: result.bytes,
            width: result.width,
            height: result.height,
            fileName: req.file.originalname
          }
        });
      }
    );

    uploadStream.end(req.file.buffer);
  } catch (err) {
    next(err);
  }
}

export async function uploadPopupAdImage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No popup ad image file attached for upload.'
      });
    }

    if (!isCloudinaryReady) {
      const base64 = req.file.buffer.toString('base64');
      const dataUri = `data:${req.file.mimetype};base64,${base64}`;

      return res.status(200).json({
        success: true,
        message: 'Ad image processed in development fallback mode.',
        data: {
          url: dataUri,
          public_id: `local_ad_${Date.now()}`,
          format: req.file.mimetype.split('/')[1] || 'jpg',
          fileName: req.file.originalname
        }
      });
    }

    // Stream image buffer to Cloudinary in 'elvany/popup_ads' folder
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'elvany/popup_ads',
        tags: ['elvany_popup_ad', 'entrance_advertisement'],
        resource_type: 'image'
      },
      (error, result) => {
        if (error) {
          return next(error);
        }

        res.status(200).json({
          success: true,
          message: 'Advertisement image successfully uploaded to Cloudinary CDN.',
          data: {
            url: result.secure_url,
            public_id: result.public_id,
            format: result.format,
            bytes: result.bytes,
            width: result.width,
            height: result.height,
            fileName: req.file.originalname
          }
        });
      }
    );

    uploadStream.end(req.file.buffer);
  } catch (err) {
    next(err);
  }
}


