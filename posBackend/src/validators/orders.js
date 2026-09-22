const { z } = require('zod');

const orderItemSchema = z.object({
  producto_id: z.string().uuid(),
  cantidad: z.number().int().positive('cantidad debe ser entero > 0'),
  observacion: z.string().trim().max(500).nullable().optional(),
}).strip();

const createOrderSchema = z.object({
  mesa_id: z.string().uuid().nullable().optional(),
  mesero_id: z.string().uuid().nullable().optional(),
  estado: z.enum(['abierto', 'en_preparacion', 'entregado', 'cobrado', 'cancelado']).optional().default('abierto'),
  items: z.array(orderItemSchema).min(1, 'al menos un item requerido'),
  observacion: z.string().trim().max(500).nullable().optional(),
});

const updateOrderSchema = z.object({
  mesa_id: z.string().uuid().nullable().optional(),
  estado: z.enum(['abierto', 'en_preparacion', 'entregado', 'cobrado', 'cancelado']).optional(),
  items: z.array(orderItemSchema).min(1).optional(),
  observacion: z.string().trim().max(500).nullable().optional(),
}).refine((data) => Object.keys(data).length > 0, { message: 'al menos un campo requerido' });

// Aliases exigidos por spec
const orderSchema = createOrderSchema;
const pedidoSchema = createOrderSchema;

module.exports = { orderSchema, pedidoSchema, createOrderSchema, updateOrderSchema, orderItemSchema };
