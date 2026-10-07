import dynamic from "next/dynamic";

const HotelPMSApp = dynamic(() => import("../components/HotelPMSApp"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)",
        color: "white",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "1rem", color: "#60a5fa" }}>
          <i className="fas fa-hotel"></i>
        </div>
        <div style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "0.5px" }}>
          HOTEL PMS
        </div>
        <div style={{ fontSize: "0.85rem", opacity: 0.75, marginTop: "0.5rem" }}>
          Next.js mühiti başladılır...
        </div>
      </div>
    </div>
  ),
});

export default function Page() {
  return <HotelPMSApp />;
}
