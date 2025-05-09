import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'react-hot-toast';
import { useSelector, useDispatch } from 'react-redux';
import {
  submitOnboardingForm,
  selectOnboardingData,
  selectOnboardingStatus,
  selectOnboardingError,
  updateFormData,
  selectApplicationStatus,
  selectCurrentStep,
  setCurrentStep,
  setRequestFromHomeState,
  selectRequestFromHomeState,
  resubmitApplication,
} from '@/store/slices/onboardingSlice';
import { uploadDocument } from '@/store/slices/uploadDocumentSlice';
import { useEffect, useRef, useState } from 'react';
import { AppDispatch } from '@/store/store';
import { useNavigate } from 'react-router-dom';
import { ApplicationStatus, pageTwoSchema, OnboardingFormData } from './schema';
import { CitizenshipType, WorkAuthorizationType, DocumentType } from '@/components/onboarding/schema';

type DocumentTypeValues = (typeof DocumentType)[keyof typeof DocumentType];

interface OnboardingFormTwoProps {
  initialData?: OnboardingFormData;
  isEditMode?: boolean;
  isResubmission?: boolean;
}

interface TempFileUpload {
  file: File;
  type: DocumentTypeValues;
  previewUrl: string;
}

export default function OnboardingFormTwo({
  initialData,
  isEditMode = false,
  isResubmission = false,
}: OnboardingFormTwoProps) {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const formData = useSelector(selectOnboardingData);
  const status = useSelector(selectOnboardingStatus);
  const error = useSelector(selectOnboardingError);
  const applicationStatus = useSelector(selectApplicationStatus);
  const currentStep = useSelector(selectCurrentStep);
  const dataToUse = initialData || formData;

  const [documents, setDocuments] = useState<File[]>([]);
  const [documentPreviews, setDocumentPreviews] = useState<{ [key: string]: string }>({});
  const requestFromHomeState = useSelector(selectRequestFromHomeState);
  const [tempUploads, setTempUploads] = useState<TempFileUpload[]>([]);

  const form = useForm<z.infer<typeof pageTwoSchema>>({
    resolver: zodResolver(pageTwoSchema),
    defaultValues: {
      citizenshipStatus: dataToUse?.citizenshipStatus || {
        isPermanentResident: false,
        type: undefined,
        workAuthorizationType: undefined,
        workAuthorizationOther: '',
        startDate: '',
        expirationDate: '',
      },
      reference: dataToUse?.reference || undefined,
      emergencyContacts: dataToUse?.emergencyContacts || undefined,
      documents: dataToUse?.documents || [],
    },
  });

  const [isPermanentResident, setIsPermanentResident] = useState(
    form.getValues().citizenshipStatus?.isPermanentResident || false,
  );

  const [workAuthType, setWorkAuthType] = useState(form.getValues().citizenshipStatus?.workAuthorizationType || '');

  // Handle back (to page 1)
  const handleBack = () => {
    const values = form.getValues();
    dispatch(
      updateFormData({
        ...formData,
        ...values,
      }),
    );
    dispatch(setCurrentStep(1));
  };

  useEffect(() => {
    const formValues = form.watch();

    if (formValues.citizenshipStatus?.isPermanentResident !== undefined) {
      setIsPermanentResident(formValues.citizenshipStatus.isPermanentResident);
    }

    if (formValues.citizenshipStatus?.workAuthorizationType) {
      setWorkAuthType(formValues.citizenshipStatus.workAuthorizationType);
    }
  }, [form.watch()]);

  const formInitialized = useRef(false);

  useEffect(() => {
    if (isEditMode && formData && currentStep === 2 && !formInitialized.current) {
      form.reset(formData);
      formInitialized.current = true;
    }
  }, [formData, form.reset, currentStep, isEditMode]);

  useEffect(() => {
    if (requestFromHomeState === 'submit_request_two' && isEditMode) {
      console.log('Submitting form 2');
      form.handleSubmit(onSubmit, (errors) => console.error('Errors in form 2 submit', errors))();
      dispatch(setRequestFromHomeState('submit_received'));
    }
  }, [requestFromHomeState, dispatch, form, isEditMode]);

  useEffect(() => {
    const isPermanentResidentValue = form.watch('citizenshipStatus.isPermanentResident');
    if (isPermanentResidentValue !== undefined) {
      setIsPermanentResident(isPermanentResidentValue);
    }
  }, [form.watch('citizenshipStatus.isPermanentResident')]);

  // Initialize form with existing data
  useEffect(() => {
    if (isResubmission && dataToUse?.documents) {
      console.log('Resubmission mode, setting up existing documents:', dataToUse.documents);

      // Set document previews from existing documents
      const previews = dataToUse.documents.reduce(
        (acc, doc) => ({
          ...acc,
          [doc.type]: doc.fileName,
        }),
        {},
      );

      console.log('Setting document previews:', previews);
      setDocumentPreviews(previews);

      // Set form documents
      form.setValue('documents', dataToUse.documents);
    }
  }, [isResubmission, dataToUse?.documents]);

  // Handle file selection
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, type: DocumentTypeValues) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];

      // Clean up previous temporary file of the same type
      const previousUpload = tempUploads.find((upload) => upload.type === type);
      if (previousUpload) {
        URL.revokeObjectURL(previousUpload.previewUrl);
      }


      // Create a temporary URL for preview
      const previewUrl = URL.createObjectURL(file);

      // Remove previous upload of the same type and add new one
      setTempUploads((prev) => [
        ...prev.filter((upload) => upload.type !== type),
        {
          file,
          type,
          previewUrl,
        },
      ]);

      // Update document preview
      setDocumentPreviews((prev) => ({
        ...prev,
        [type]: file.name,
      }));
      
      toast.success('File selected successfully');
    }
  };

  // Upload files to S3 and return document info
  const uploadFilesToS3 = async (files: TempFileUpload[]): Promise<any[]> => {
    const uploadedDocs = [];

    for (const { file, type } of files) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData,
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        const data = await response.json();
        uploadedDocs.push({
          type,
          fileName: data.fileName,
          fileUrl: data.fileUrl,
          uploadDate: data.uploadDate ? new Date(data.uploadDate).toISOString() : new Date().toISOString(),
        });
      } catch (error) {
        console.error('Upload failed:', error);
        toast.error(`Failed to upload ${file.name}`);
        throw error;
      }
    }

    return uploadedDocs;
  };

  async function onSubmit(values: z.infer<typeof pageTwoSchema>) {
    try {
      if (!tempUploads.some(doc => doc.type === DocumentType.DriverLicense) && !formData.documents?.some(doc => doc.type === DocumentType.DriverLicense)) {
        form.setError("documents", { message: "Driver's license is required" });
        return;
      }

      const workAuthType = values.citizenshipStatus?.workAuthorizationType

      const isF1Visa = workAuthType === WorkAuthorizationType.F1;
      if (isF1Visa && !tempUploads.some(doc => doc.type === DocumentType.OPTReceipt) && !formData.documents?.some(doc => doc.type === DocumentType.OPTReceipt) ) {
        form.setError("documents", { message: "OPT Receipt is required for F1 visa holders" });
        return;
      }

      const needWorkAuthorization = workAuthType === WorkAuthorizationType.H1B 
      || workAuthType === WorkAuthorizationType.H4 
      || workAuthType === WorkAuthorizationType.L2 
      || workAuthType === WorkAuthorizationType.Other;
      if (needWorkAuthorization && !tempUploads.some(doc => doc.type === DocumentType.WorkAuthorization) && !formData.documents?.some(doc => doc.type === DocumentType.WorkAuthorization)) {
        form.setError("documents", { message: "Work authorization file is required" });
        return;
      }
      
      // Upload all temporary files to S3
      const uploadedDocs = await uploadFilesToS3(tempUploads);

      const allDocuments = [...(formData.documents || []), ...(values.documents || []), ...uploadedDocs].filter(
        (doc, index, self) => index === self.findIndex((d) => d.fileUrl === doc.fileUrl),
      );

      const completeData = {
        ...formData,
        ...values,
        documents: allDocuments,
        status: applicationStatus === ApplicationStatus.Rejected ? ApplicationStatus.Pending : applicationStatus,
      };

      dispatch(updateFormData(completeData));
      console.log('Submitting combined data:', completeData);
      console.log('Resubmission: ', isResubmission);

      dispatch(submitOnboardingForm(completeData));

      // Clean up temporary URLs
      tempUploads.forEach((upload) => URL.revokeObjectURL(upload.previewUrl));
      setTempUploads([]);
    } catch (error) {
      console.error('Form submission failed:', error);
      toast.error('Failed to submit form. Please try again.');
    }
  }

  // Clean up temporary URLs when component unmounts
  useEffect(() => {
    return () => {
      tempUploads.forEach((upload) => URL.revokeObjectURL(upload.previewUrl));
    };
  }, [tempUploads]);

  useEffect(() => {
    if (status === 'failed' && applicationStatus !== ApplicationStatus.NeverSubmitted && error) {
      toast.error(error);
    }
  }, [status, error, navigate]);

  return (
    <div className={`w-full max-w-3xl mx-auto p-6 bg-white ${isEditMode ? '' : 'rounded-lg shadow'}`}>
      {!isEditMode && <h2 className="text-xl font-bold mb-4">Citizenship & References</h2>}

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit, (errors) => console.error('Errors in form 2 submit', errors))}
          className="space-y-6"
        >
          {/* Citizenship Status */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Citizenship Status</h3>

            <FormField
              control={form.control}
              name="citizenshipStatus.isPermanentResident"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="flex">
                    Are you a permanent resident or citizen of the U.S.?<span className="text-red-500 ml-1">*</span>
                  </FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={(value) => {
                        const isResident = value === 'true';
                        setIsPermanentResident(isResident);
                        field.onChange(isResident);
                      }}
                      value={field.value ? 'true' : 'false'} // Controlled component
                      className="flex flex-row space-x-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="true" id="yes" />
                        <label htmlFor="yes">Yes</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="false" id="no" />
                        <label htmlFor="no">No</label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Conditional fields based on citizenship status */}
            {isPermanentResident ? (
              <FormField
                control={form.control}
                name="citizenshipStatus.type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex">
                      Status Type<span className="text-red-500 ml-1">*</span>
                    </FormLabel>
                    <Select
                      onValueChange={(value) => {
                        setWorkAuthType(value);
                        field.onChange(value);
                      }}
                      value={field.value || ''}
                    >
                      {' '}
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={CitizenshipType.GreenCard}>Green Card</SelectItem>
                        <SelectItem value={CitizenshipType.Citizen}>Citizen</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="citizenshipStatus.type"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input type="hidden" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="citizenshipStatus.workAuthorizationType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex">
                        What is your work authorization?<span className="text-red-500 ml-1">*</span>
                      </FormLabel>
                      <Select
                        onValueChange={(value) => {
                          setWorkAuthType(value);
                          field.onChange(value);
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select work authorization" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={WorkAuthorizationType.H1B}>H1-B</SelectItem>
                          <SelectItem value={WorkAuthorizationType.H4}>H4</SelectItem>
                          <SelectItem value={WorkAuthorizationType.L2}>L2</SelectItem>
                          <SelectItem value={WorkAuthorizationType.F1}>F1 (CPT/OPT)</SelectItem>
                          <SelectItem value={WorkAuthorizationType.Other}>Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {workAuthType === WorkAuthorizationType.Other && (
                  <FormField
                    control={form.control}
                    name="citizenshipStatus.workAuthorizationOther"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex">
                          Please specify<span className="text-red-500 ml-1">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {workAuthType === WorkAuthorizationType.F1 && (
                  <div className="border p-4 rounded-md">
                    <FormLabel className="block mb-2">OPT Receipt</FormLabel>
                    <div className="relative">
                      <Button variant="outline" className="w-[120px]" asChild>
                        <label>
                          Choose File
                          <Input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => handleFileUpload(e, DocumentType.OPTReceipt)}
                            className="hidden"
                          />
                        </label>
                      </Button>
                      <span className="ml-3 text-sm">
                        {documentPreviews[DocumentType.OPTReceipt] || 'No file chosen'}
                      </span>
                    </div>
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="citizenshipStatus.startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex">
                        Start Date<span className="text-red-500 ml-1">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          value={field.value?.split('T')[0] || ''}
                          onChange={(e) => {
                            const value = e.target.value ? `${e.target.value}T00:00:00Z` : '';
                            field.onChange(value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="citizenshipStatus.expirationDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex">
                        Expiration Date<span className="text-red-500 ml-1">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          value={field.value?.split('T')[0] || ''}
                          onChange={(e) => {
                            const value = e.target.value ? `${e.target.value}T00:00:00Z` : '';
                            field.onChange(value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2 mt-10">
              <Checkbox
                id="includeReference"
                checked={!!form.watch('reference')}
                onCheckedChange={(checked) => {
                  if (checked) {
                    form.setValue('reference', {
                      firstName: '',
                      middleName: '',
                      lastName: '',
                      phone: '',
                      email: '',
                      relationship: '',
                    });
                  } else {
                    form.setValue('reference', undefined);
                  }
                }}
              />
              <label htmlFor="includeReference" className="text-lg font-semibold">
                Add Reference Information
              </label>
            </div>

            {/* Reference Information */}
            {form.watch('reference') && (
              <div className="space-y-4 mt-8">
                <FormField
                  control={form.control}
                  name="reference.firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex">
                        First Name<span className="text-red-500 ml-1">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="reference.middleName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Middle Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="reference.lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex">
                          Last Name<span className="text-red-500 ml-1">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="reference.phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex">
                          Phone<span className="text-red-500 ml-1">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="reference.email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex">
                          Email<span className="text-red-500 ml-1">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="reference.relationship"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex">
                        Relationship<span className="text-red-500 ml-1">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </div>

          {/* Emergency Contact */}

          <div className="flex items-center space-x-2 mt-6">
            <Checkbox
              id="includeEmergencyContact"
              checked={!!form.watch('emergencyContacts') && form.watch('emergencyContacts')?.length !== 0}
              onCheckedChange={(checked) => {
                if (checked) {
                  form.setValue('emergencyContacts', [
                    { firstName: '', middleName: '', lastName: '', phone: '', email: '', relationship: '' },
                  ]);
                } else {
                  form.setValue('emergencyContacts', undefined);
                }
              }}
            />
            <label htmlFor="includeEmergencyContact" className="text-lg font-semibold">
              Add Emergency Contacts
            </label>
          </div>
          <div className="space-y-4 mt-8">
            {form.watch('emergencyContacts')?.map((_, index) => (
              <Card key={index} className="p-4">
                <CardContent className="p-0 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name={`emergencyContacts.${index}.firstName`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex">
                            First Name<span className="text-red-500 ml-1">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`emergencyContacts.${index}.middleName`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Middle Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`emergencyContacts.${index}.lastName`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex">
                            Last Name<span className="text-red-500 ml-1">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <FormField
                      control={form.control}
                      name={`emergencyContacts.${index}.phone`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex">
                            Phone<span className="text-red-500 ml-1">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`emergencyContacts.${index}.email`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex">
                            Email<span className="text-red-500 ml-1">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`emergencyContacts.${index}.relationship`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex">
                            Relationship<span className="text-red-500 ml-1">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const currentContacts = form.getValues().emergencyContacts || [];
                form.setValue('emergencyContacts', [
                  ...currentContacts,
                  { firstName: '', middleName: '', lastName: '', phone: '', email: '', relationship: '' },
                ]);
              }}
            >
              Add Another Emergency Contact
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const currentContacts = form.getValues().emergencyContacts || [];
                currentContacts.pop();
                form.setValue('emergencyContacts', currentContacts);
              }}
            >
              Remove Emergency Contact
            </Button>
          </div>

          {/* Document Uploads */}
          <div className="space-y-4 mt-8">
            <h3 className="text-lg font-semibold">Required Documents</h3>
            {form.formState.errors.documents && (
    <div className="p-3 bg-red-50 border border-red-200 rounded-md">
      <p className="text-red-500 text-sm">
        {form.formState.errors.documents.message}
      </p>
    </div>
  )}
            {isResubmission && (
              <div className="mb-4 p-4 bg-blue-50 rounded">
                <p className="text-sm text-blue-600">
                  You can keep your existing documents or upload new ones to replace them.
                </p>
              </div>
            )}

            <div className="border p-4 rounded-md">
              <FormLabel className="block mb-2">Driver's License</FormLabel>
              <div className="relative">
                <Button variant="outline" className="w-[120px]" asChild>
                  <label>
                    Choose File
                    <Input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileUpload(e, DocumentType.DriverLicense)}
                      className="hidden"
                    />
                  </label>
                </Button>
                <span className="ml-3 text-sm">
                    {documentPreviews[DocumentType.DriverLicense] || 'No file chosen'}
                  </span>
              </div>
            </div>

            {!isPermanentResident && (
              <div className="border p-4 rounded-md">
                <FormLabel className="block mb-2">Work Authorization Document</FormLabel>
                <div className="relative">
                  <Button variant="outline" className="w-[120px]" asChild>
                    <label>
                      Choose File
                      <Input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileUpload(e, DocumentType.WorkAuthorization)}
                        className="hidden"
                      />
                    </label>
                  </Button>
                  <span className="ml-3 text-sm">
                    {documentPreviews[DocumentType.WorkAuthorization] || 'No file chosen'}
                  </span>
                </div>
              </div>
            )}

            {workAuthType === WorkAuthorizationType.F1 && (
              <div className="border p-4 rounded-md">
                <FormLabel className="block mb-2">OPT Receipt</FormLabel>
                <div className="relative">
                  <Button variant="outline" className="w-[120px]" asChild>
                    <label>
                      Choose File
                      <Input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileUpload(e, DocumentType.OPTReceipt)}
                        className="hidden"
                      />
                    </label>
                  </Button>
                  <span className="ml-3 text-sm">{documentPreviews[DocumentType.OPTReceipt] || 'No file chosen'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Buttons */}
          {!isEditMode && (
            <div className="flex justify-between pt-6">
              <Button type="button" variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button type="submit">Submit</Button>
            </div>
          )}
        </form>
      </Form>
    </div>
  );
}
