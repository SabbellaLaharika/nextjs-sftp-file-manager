import { Client, ConnectConfig } from "ssh2";

let sftpClient: Client | null = null;
let sftpInstance: any = null;

const createSftpConnection = async (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if (sftpInstance) {
      resolve(sftpInstance);
      return;
    }

    const host = process.env.SFTP_HOST || "sftp";
    const port = parseInt(process.env.SFTP_PORT || "22");
    const username = process.env.SFTP_USER || "testuser";
    const password = process.env.SFTP_PASSWORD || "testpass";

    const config: ConnectConfig = {
      host,
      port,
      username,
      password,
      readyTimeout: 5000,
    };

    const client = new Client();

    client
      .on("ready", () => {
        client.sftp((err, sftp) => {
          if (err) {
            client.end();
            return reject(err);
          }
          sftpClient = client;
          sftpInstance = sftp;
          resolve(sftp);
        });
      })
      .on("error", (err) => {
        sftpClient = null;
        sftpInstance = null;
        reject(err);
      })
      .on("end", () => {
        sftpClient = null;
        sftpInstance = null;
      })
      .on("close", () => {
        sftpClient = null;
        sftpInstance = null;
      })
      .connect(config);
  });
};

export const getSftp = async (): Promise<any> => {
  if (sftpInstance) {
    return sftpInstance;
  }
  return await createSftpConnection();
};

export const closeSftp = () => {
  if (sftpClient) {
    sftpClient.end();
    sftpClient = null;
    sftpInstance = null;
  }
};

export const listDirectory = async (path: string): Promise<any[]> => {
  const sftp = await getSftp();
  return new Promise((resolve, reject) => {
    sftp.readdir(path, (err: any, list: any[]) => {
      if (err) return reject(err);
      
      const formattedList = list.map((item) => {
        const typeChar = item.longname ? item.longname.charAt(0) : "-";
        let user = "---";
        let group = "---";
        let other = "---";
        
        if (item.longname && item.longname.length >= 10) {
          user = item.longname.substring(1, 4);
          group = item.longname.substring(4, 7);
          other = item.longname.substring(7, 10);
        }

        return {
          name: item.filename,
          type: typeChar === "d" ? "d" : typeChar === "l" ? "l" : "-",
          size: item.attrs.size,
          modifyTime: item.attrs.mtime * 1000,
          rights: { user, group, other }
        };
      });

      const filteredList = formattedList.filter((item) => item.name !== "." && item.name !== "..");
      resolve(filteredList);
    });
  });
};
