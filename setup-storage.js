#!/usr/bin/env node

// Script to create Supabase Storage bucket
const { createClient } = require('@supabase/supabase-js');

async function setupStorage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Missing Supabase environment variables');
    console.log('Please make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    console.log('🔍 Checking if audio-recordings bucket exists...');
    
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      throw new Error(`Failed to list buckets: ${listError.message}`);
    }

    const bucketExists = buckets.some(bucket => bucket.name === 'audio-recordings');
    
    if (bucketExists) {
      console.log('✅ audio-recordings bucket already exists!');
    } else {
      console.log('📦 Creating audio-recordings bucket...');
      
      const { data, error } = await supabase.storage.createBucket('audio-recordings', {
        public: true,
        allowedMimeTypes: ['audio/webm', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/mpeg'],
        fileSizeLimit: 10485760 // 10MB
      });

      if (error) {
        throw new Error(`Failed to create bucket: ${error.message}`);
      }

      console.log('✅ audio-recordings bucket created successfully!');
    }

    // Test upload
    console.log('🧪 Testing storage functionality...');
    const testFile = Buffer.from('test audio content');
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio-recordings')
      .upload('test/test-file.txt', testFile, {
        contentType: 'text/plain',
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Upload test failed: ${uploadError.message}`);
    }

    console.log('✅ Storage upload test successful!');

    // Clean up test file
    await supabase.storage
      .from('audio-recordings')
      .remove(['test/test-file.txt']);

    console.log('🎉 Supabase Storage is ready to use!');
    console.log('');
    console.log('Your app will now use Supabase Storage instead of local files.');
    console.log('Audio recordings will be uploaded directly to the cloud!');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

setupStorage();
