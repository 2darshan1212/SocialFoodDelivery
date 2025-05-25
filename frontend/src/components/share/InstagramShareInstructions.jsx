import React, { useRef, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Divider,
  IconButton,
  Alert,
} from '@mui/material';
import { Instagram, Download, Copy, Check, ArrowRight, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';

/**
 * Component that provides step-by-step instructions for sharing to Instagram
 * Used when direct sharing is not available (desktop or some mobile browsers)
 */
const InstagramShareInstructions = ({ post, shareUrl, onClose }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const [imageDownloaded, setImageDownloaded] = useState(false);
  const downloadLinkRef = useRef(null);

  // Handle step navigation
  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  // Copy text to clipboard
  const handleCopyText = () => {
    const textToCopy = `${post.caption}\n\n${shareUrl}`;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      toast.success('Caption and link copied to clipboard!');
      setTimeout(() => setCopied(false), 3000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      toast.error('Failed to copy text. Please try manually selecting and copying.');
    });
  };

  // Download image for sharing
  const handleDownloadImage = () => {
    if (!post.image) return;
    
    // Trigger download using hidden anchor
    if (downloadLinkRef.current) {
      downloadLinkRef.current.click();
      setImageDownloaded(true);
      toast.success('Image downloaded successfully!');
    }
  };

  // Steps for sharing to Instagram
  const steps = [
    {
      label: 'Save the image',
      description: (
        <>
          <Typography variant="body2" className="mb-3">
            First, download the food image to your device. You'll upload this to Instagram.
          </Typography>
          {post.image ? (
            <div className="flex flex-col items-center mb-3">
              <img 
                src={post.image} 
                alt={post.caption} 
                className="w-full max-w-[250px] h-auto mb-3 rounded-lg border border-gray-200"
              />
              <Button
                variant="outlined"
                startIcon={imageDownloaded ? <Check size={16} /> : <Download size={16} />}
                onClick={handleDownloadImage}
                className="mt-2"
              >
                {imageDownloaded ? 'Image Downloaded' : 'Download Image'}
              </Button>
              {/* Hidden download link */}
              <a 
                ref={downloadLinkRef}
                href={post.image}
                download={`food-image-${post._id || Date.now()}.jpg`}
                className="hidden"
              >
                Download
              </a>
            </div>
          ) : (
            <Alert severity="warning" className="mb-3">
              <Typography variant="body2">
                No image is available for this post. You can still share the text content.
              </Typography>
            </Alert>
          )}
        </>
      ),
    },
    {
      label: 'Copy the caption and link',
      description: (
        <>
          <Typography variant="body2" className="mb-3">
            Copy this text to use as your Instagram caption. It includes details and a link back to the post.
          </Typography>
          <Paper elevation={0} className="p-3 bg-gray-50 mb-3 border border-gray-200 rounded-lg">
            <Typography variant="body2" className="whitespace-pre-line mb-2 font-medium">
              {post.caption}
            </Typography>
            <Typography variant="body2" className="text-gray-600 mb-1">
              {post.price ? `Price: ₹${post.price} • ` : ''}
              {post.category || ''}
              {post.vegetarian !== undefined ? ` • ${post.vegetarian ? 'Vegetarian' : 'Non-Vegetarian'}` : ''}
            </Typography>
            <Typography variant="body2" className="text-blue-600 break-all">
              {shareUrl}
            </Typography>
          </Paper>
          <Button
            variant="outlined"
            startIcon={copied ? <Check size={16} /> : <Copy size={16} />}
            onClick={handleCopyText}
            className="mt-1"
          >
            {copied ? 'Copied!' : 'Copy Caption & Link'}
          </Button>
        </>
      ),
    },
    {
      label: 'Share on Instagram',
      description: (
        <>
          <Typography variant="body2" className="mb-3">
            Open Instagram and follow these steps:
          </Typography>
          <ol className="list-decimal pl-5 mb-4 space-y-2">
            <li>Open the Instagram app on your device</li>
            <li>Tap the + button to create a new post</li>
            <li>Select the image you just downloaded</li>
            <li>Apply filters if desired and tap Next</li>
            <li>Paste the caption and link you copied</li>
            <li>Share your post!</li>
          </ol>
          <Alert severity="info" className="mb-3">
            <Typography variant="body2">
              <strong>Tip:</strong> For Instagram Stories, tap your profile picture or swipe right from your feed, 
              select the downloaded image, and add the text as a sticker.
            </Typography>
          </Alert>
          <Button 
            variant="contained" 
            color="primary"
            endIcon={<Instagram size={16} />}
            onClick={() => {
              // Try to open Instagram
              window.open('https://instagram.com', '_blank');
              // Close the instructions after a delay
              setTimeout(() => {
                if (onClose) onClose();
              }, 1000);
            }}
          >
            Open Instagram
          </Button>
        </>
      ),
    },
  ];

  return (
    <Box className="max-w-lg mx-auto">
      <Box className="flex items-center justify-between mb-4">
        <Box className="flex items-center">
          <Instagram size={24} className="text-pink-600 mr-2" />
          <Typography variant="h6">Share to Instagram</Typography>
        </Box>
        <Typography variant="caption" color="textSecondary">
          Follow these steps
        </Typography>
      </Box>
      
      <Divider className="mb-4" />

      <Stepper activeStep={activeStep} orientation="vertical">
        {steps.map((step, index) => (
          <Step key={step.label}>
            <StepLabel>{step.label}</StepLabel>
            <StepContent>
              <Box>
                {step.description}
                <Box className="flex justify-between mt-4">
                  <Button
                    disabled={index === 0}
                    onClick={handleBack}
                  >
                    Back
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleNext}
                    endIcon={index === steps.length - 1 ? null : <ArrowRight size={16} />}
                  >
                    {index === steps.length - 1 ? 'Finish' : 'Next'}
                  </Button>
                </Box>
              </Box>
            </StepContent>
          </Step>
        ))}
      </Stepper>

      {activeStep === steps.length && (
        <Paper square elevation={0} className="p-4 mt-4 bg-green-50 rounded-lg">
          <Typography variant="body1" className="mb-2 font-medium">
            All steps completed - you're ready to share!
          </Typography>
          <Button 
            onClick={onClose} 
            variant="contained" 
            color="primary"
            className="mt-2"
          >
            Close
          </Button>
        </Paper>
      )}
    </Box>
  );
};

export default InstagramShareInstructions;
