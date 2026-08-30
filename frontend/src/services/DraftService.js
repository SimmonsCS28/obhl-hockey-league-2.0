const API_BASE_URL = import.meta.env.VITE_API_URL?.replace('/api/v1', '/api') || '/api';

/**
 * Registration spreadsheet upload.
 *
 * Deliberately a raw fetch rather than the shared request() client in services/api.js:
 * this is multipart/form-data and request() forces Content-Type: application/json, which
 * strips the multipart boundary and breaks the upload. Every other draft call goes
 * through leagueDraftApi.js.
 */
export const DraftService = {
    async importRegistration(file) {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${API_BASE_URL}/league/import/registration`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Failed to upload file');
            }

            return await response.json();
        } catch (error) {
            console.error('Upload error:', error);
            throw error;
        }
    }
};

export default DraftService;
