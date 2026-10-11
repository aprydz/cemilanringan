import { Router } from 'express'
import { requireAuth, requireRole } from '../../middlewares/require-auth.js'
import { adminProductsRouter } from './products.routes.js'
import { adminTaxonomyRouter } from './taxonomy.routes.js'
import { adminCouponsRouter } from './coupons.routes.js'
import { adminPromotionsRouter } from './promotions.routes.js'
import { adminOrdersRouter } from './orders.routes.js'
import { adminInventoryRouter } from './inventory.routes.js'
import { adminCustomersRouter } from './customers.routes.js'
import { adminReportsRouter } from './reports.routes.js'

export const adminRouter = Router()

adminRouter.use(requireAuth, requireRole('ADMIN'))

adminRouter.use(adminProductsRouter)
adminRouter.use(adminTaxonomyRouter)
adminRouter.use(adminCouponsRouter)
adminRouter.use(adminPromotionsRouter)
adminRouter.use(adminOrdersRouter)
adminRouter.use(adminInventoryRouter)
adminRouter.use(adminCustomersRouter)
adminRouter.use(adminReportsRouter)
