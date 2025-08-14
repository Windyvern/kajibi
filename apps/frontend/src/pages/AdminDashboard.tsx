
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const AdminDashboard = () => {

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Content Management</h1>
          <p className="text-gray-600">Manage your stories and content through Strapi CMS</p>
        </div>

        {/* Strapi Dashboard Link */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink size={20} />
              Strapi CMS Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-gray-600">
                Access your Strapi dashboard to create and manage stories, upload media, and configure content.
              </p>
              <Button 
                onClick={() => window.open('http://localhost:1337/admin', '_blank')}
                className="flex items-center gap-2"
              >
                <ExternalLink size={16} />
                Open Strapi Dashboard
              </Button>
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">Setup Instructions:</h3>
                <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                  <li>Install Strapi: <code className="bg-blue-100 px-1 rounded">npx create-strapi-app@latest my-strapi-project</code></li>
                  <li>Configure the database connection to match your current schema</li>
                  <li>Create content types for Stories and Story Panels</li>
                  <li>Update the URL above to match your Strapi instance</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Database Schema Info */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Database Schema</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Your current database is already compatible with Strapi. The existing tables (stories, story_panels) 
              follow Strapi conventions and can be easily integrated.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded">
                <h4 className="font-medium">Stories Table</h4>
                <p className="text-sm text-gray-600">Contains story metadata, location, and publishing info</p>
              </div>
              <div className="p-3 bg-gray-50 rounded">
                <h4 className="font-medium">Story Panels Table</h4>
                <p className="text-sm text-gray-600">Contains individual story panels with content and media</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
