async function loadProtocol(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error("Protocol not found");
    return await response.json();
  } catch (error) {
    document.getElementById('protocol-container').innerHTML = `<p style="color:red;">Failed to load protocol: ${error.message}</p>`;
    return { title: "Error", steps: [] };
  }
}
