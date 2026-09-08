export const handleExportQuote = (opts: { data: unknown; quoteNumber?: string; suffix?: string }): void => {
    const { data, quoteNumber, suffix } = opts;
    const fileName = `${quoteNumber || 'quote'}${suffix ? `-${suffix}` : ''}.json`;

    // Create a blob with the JSON data
    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
    });

    // Create a download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;

    // Trigger the download
    document.body.appendChild(link);
    link.click();

    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
