import Navbar from "../components/Navbar";

function Home() {
  return (
    <div>
      <Navbar />
      <div style={{ padding: "40px" }}>
        <h1>Welcome to your Dashboard</h1>
        <p>You are successfully logged in.</p>
      </div>
    </div>
  );
}

export default Home;