import { AdminCouponManager } from "@/components/admin/admin-coupon-manager";

export const metadata = {
  title: "Cupons"
};

export default function AdminCouponsPage() {
  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Cupons</h1>
          <p>Descontos controlados por limite de uso ou uso ilimitado.</p>
        </div>
      </div>

      <AdminCouponManager />
    </div>
  );
}
