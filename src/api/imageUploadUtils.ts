import { ChangeEvent, Dispatch, SetStateAction } from 'react';

const GITHUB_ACCESS_TOKEN = import.meta.env.VITE_GITHUB_ACCESS_TOKEN;

const handleImageUpload = async (
    e: ChangeEvent<HTMLInputElement>,
    setIsLoading: Dispatch<SetStateAction<boolean>>,
    setImageUrls: Dispatch<SetStateAction<string[]>>
) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    try {
        setIsLoading(true);
        const uploadedUrls: string[] = [];

        for (const file of files) {
            const token = GITHUB_ACCESS_TOKEN;
            const owner = 'LivingRoomcode';
            const repo = 'llmImage';
            const branch = 'main';
            const path = `images/${file.name}`;

            const reader:any = new FileReader();
            //将图片内容编码为 Base64 字符串的格式
            reader.readAsDataURL(file);

            await new Promise((resolve, reject) => {
                reader.onload = async () => {
                    // DataURL 格式通常为 data: image / jpeg; base64, /9j/4AAQSkZJRgABAQEASABIAAD...
                    // 通过 split(',') 分割字符串并取第二个元素。
                    const base64Data = reader.result.toString().split(',')[1];

                    try {
                        // 先发生获取请求检查图片文件是否存在并获取 SHA
                        let sha: string | null = null;
                        try {
                            const getResponse = await fetch(
                                `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
                                {
                                    headers: {
                                        'Authorization': `token ${token}`,
                                        'Accept': 'application/vnd.github.v3+json'
                                    }
                                }
                            );

                            if (getResponse.ok) {
                                const data = await getResponse.json();
                                sha = data.sha; // 提取现有文件的 SHA
                            } else if (getResponse.status !== 404) {
                                const errorData = await getResponse.json();
                                throw new Error(errorData.message || '获取文件信息失败');
                            }
                        } catch (error:any) {
                            reject(new Error('检查文件时出错: ' + error.message));
                            return;
                        }

                        // 构建请求体（包含 SHA 参数如果存在）
                        const bodyData: any = {
                            message: `Upload ${file.name}`,
                            content: base64Data,
                            branch: branch
                        };
                        if (sha) bodyData.sha = sha; // 添加 SHA 用于更新

                        // 上传文件
                        const putResponse = await fetch(
                            `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
                            {
                                method: 'PUT',
                                headers: {
                                    'Authorization': `token ${token}`,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify(bodyData)
                            }
                        );

                        const putData = await putResponse.json();
                        if (putResponse.ok) {
                            const imageUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
                            uploadedUrls.push(imageUrl);
                            resolve(null);
                        } else {
                            reject(new Error(putData.message));
                        }
                    } catch (error) {
                        reject(error);
                    }
                };

                reader.onerror = () => reject(new Error('读取文件失败'));
            });
        }

        setImageUrls(prev => [...prev, ...uploadedUrls]);
        console.log('所有上传图片的 URL:', uploadedUrls);
    } catch (error:any) {
        alert('上传失败: ' + error.message);
    } finally {
        setIsLoading(false);
    }
};

export default handleImageUpload;