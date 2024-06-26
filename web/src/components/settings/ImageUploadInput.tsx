import CloudUpload from '@mui/icons-material/CloudUpload';
import FormControl, { FormControlProps } from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import OutlinedInput, { OutlinedInputProps } from '@mui/material/OutlinedInput';
import { styled } from '@mui/material/styles';
import React, { ChangeEvent, useCallback, useRef } from 'react';
import { useTunarrApi } from '../../hooks/useTunarrApi';

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

type Props = {
  FormControlProps?: FormControlProps;
  InputProps?: OutlinedInputProps;
  label: string;
  value: string;
  onFormValueChange(value: string): void;
  onUploadError(error: unknown): void;
  fileRenamer(name: File): string;
  children?: React.ReactNode;
};

export function ImageUploadInput({
  FormControlProps,
  InputProps,
  label,
  onFormValueChange: onChange,
  onUploadError,
  fileRenamer,
  value,
  children,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const apiClient = useTunarrApi();
  const handleFileUpload = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        const data = new FormData();
        const file = e.target.files[0];
        const newName = fileRenamer(file);
        const renamedFile = new File(
          [file.slice(0, file.size, file.type)],
          newName,
          {
            type: file.type,
          },
        );

        data.append('file', renamedFile);

        apiClient
          .uploadImage({ file: renamedFile })
          .then((response) => {
            onChange(response.data.fileUrl);
          })
          .catch((err) => {
            console.error(err);
            onUploadError(err);
          });
      }
    },
    [fileRenamer, apiClient, onChange, onUploadError],
  );

  const onThumbUrlChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange],
  );

  return (
    <FormControl {...(FormControlProps ?? {})}>
      <InputLabel>{label}</InputLabel>
      <OutlinedInput
        label={label}
        value={value}
        onChange={onThumbUrlChange}
        endAdornment={
          <InputAdornment position="end">
            <IconButton
              component="label"
              onClick={() => (fileInputRef.current!.value = '')}
            >
              <CloudUpload />
              <VisuallyHiddenInput
                ref={fileInputRef}
                onChange={(e) => {
                  handleFileUpload(e);
                }}
                type="file"
                accept="image/*"
              />
            </IconButton>
          </InputAdornment>
        }
        {...(InputProps ?? {})}
      />
      {children}
    </FormControl>
  );
}
