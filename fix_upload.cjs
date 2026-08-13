const fs = require('fs');

let file = fs.readFileSync('src/features/issues/ReportIssuePage.tsx', 'utf8');

// Add Upload to imports
file = file.replace("Card, App, Row, Col, Typography, Tag, Table, Modal, Empty } from 'antd'", "Card, App, Row, Col, Typography, Tag, Table, Modal, Empty, Upload } from 'antd'");
file = file.replace("ToolOutlined, CameraOutlined, LinkOutlined, ExclamationCircleOutlined } from '@ant-design/icons'", "ToolOutlined, CameraOutlined, LinkOutlined, ExclamationCircleOutlined, UploadOutlined } from '@ant-design/icons'\nimport type { UploadFile } from 'antd/es/upload/interface'");

// Add state for fileList
file = file.replace("const [selectedIssue, setSelectedIssue] = useState<IssueReport | null>(null)", "const [selectedIssue, setSelectedIssue] = useState<IssueReport | null>(null)\n  const [fileList, setFileList] = useState<UploadFile[]>([])");

// Replace Form.Item for imageUrl
const oldUploadItem = `<Form.Item name="imageUrl" label="Ảnh minh chứng (Không bắt buộc)" tooltip="Tính năng tải ảnh hiện chỉ hỗ trợ khi backend có API tương ứng. Bạn có thể dán link ảnh vào đây.">
                <Input prefix={<CameraOutlined />} placeholder="Link ảnh (nếu có)" />
              </Form.Item>`;

const newUploadItem = `<Form.Item label="Ảnh sự cố (Không bắt buộc)">
                <Upload 
                  listType="picture-card" 
                  fileList={fileList} 
                  onChange={({ fileList: newFileList }) => setFileList(newFileList)}
                  beforeUpload={() => false}
                  maxCount={1}
                >
                  {fileList.length >= 1 ? null : <div><UploadOutlined /><div style={{ marginTop: 8 }}>Tải ảnh lên</div></div>}
                </Upload>
              </Form.Item>`;

file = file.replace(oldUploadItem, newUploadItem);

// We need to convert image to base64 if there's a file
const oldOnFinish = `const onFinish = (values: any) => {
    modal.confirm({
      title: 'Xác nhận gửi báo cáo sự cố',
      icon: <ExclamationCircleOutlined />,
      content: 'Bạn có chắc chắn muốn gửi báo cáo sự cố này? Bộ phận kỹ thuật sẽ nhận được thông báo ngay lập tức.',
      okText: 'Gửi báo cáo',
      cancelText: 'Hủy',
      onOk: () => {
        createIssueMutation.mutate(values)
      }
    })
  }`;

const newOnFinish = `const getBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });

  const onFinish = async (values: any) => {
    let imageUrl = values.imageUrl;
    
    if (fileList.length > 0 && fileList[0].originFileObj) {
      imageUrl = await getBase64(fileList[0].originFileObj as File);
    }

    const payload = { ...values, imageUrl };

    modal.confirm({
      title: 'Xác nhận gửi báo cáo sự cố',
      icon: <ExclamationCircleOutlined />,
      content: 'Bạn có chắc chắn muốn gửi báo cáo sự cố này? Bộ phận kỹ thuật sẽ nhận được thông báo ngay lập tức.',
      okText: 'Gửi báo cáo',
      cancelText: 'Hủy',
      onOk: () => {
        createIssueMutation.mutate(payload)
      }
    })
  }`;

file = file.replace(oldOnFinish, newOnFinish);

// On success, reset fileList
file = file.replace("form.resetFields()", "form.resetFields()\n      setFileList([])");

fs.writeFileSync('src/features/issues/ReportIssuePage.tsx', file);
