export const os = [
  {
    desc: "Android",
    ua: "Mozilla/5.0 (Linux; U; Android 2.2.2; en-us; VM670 Build/FRG83G) AppleWebKit/533.1 (KHTML, like Gecko)",
    expect: {
      name: "Android",
      version: "2.2.2",
    },
  },
  {
    desc: "MIUI",
    ua: "Dalvik/2.1.0 (Linux; U; Android 9; Mi MIX 3 5G MIUI/V10.3.2.0.PEMEUVF)",
    expect: {
      name: "Android",
      version: "9",
    },
  },
  {
    desc: "KTB-Nexus 5",
    ua: "APP-My App/1.0 (Linux; Android 4.2.1; Nexus 5 Build/JOP40D)",
    expect: {
      name: "Android",
      version: "4.2.1",
    },
  },
  {
    desc: "iOS 18.6",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1",
    expect: {
      name: "iOS",
      version: "18.6",
    },
  },
  {
    desc: "iOS 26",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1",
    expect: {
      name: "iOS",
      version: "26.0",
    },
  },
  {
    desc: "iOS in App",
    ua: "AppName/version CFNetwork/version Darwin/version",
    expect: {
      name: "iOS",
      version: "undefined",
    },
  },
  {
    desc: "iOS with Chrome",
    ua: "Mozilla/5.0 (iPhone; U; CPU iPhone OS 5_1_1 like Mac OS X; en) AppleWebKit/534.46.0 (KHTML, like Gecko) CriOS/19.0.1084.60 Mobile/9B206 Safari/7534.48.3",
    expect: {
      name: "iOS",
      version: "5.1.1",
    },
  },
  {
    desc: "iOS with DuckDuckGo",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1 Ddg/26.0",
    expect: {
      name: "iOS",
      version: "18.7",
    },
  },
  {
    desc: "iOS with Opera Mini",
    ua: "Opera/9.80 (iPhone; Opera Mini/7.1.32694/27.1407; U; en) Presto/2.8.119 Version/11.10",
    expect: {
      name: "iOS",
      version: "undefined",
    },
  },
  {
    desc: "iOS with FaceBook Mobile App",
    ua: "[FBAN/FBIOS;FBAV/283.0.0.44.117;FBBV/238386386;FBDV/iPhone12,1;FBMD/iPhone;FBSN/iOS;FBSV/13.6.1;FBSS/2;FBID/phone;FBLC/en_US;FBOP/5;FBRV/240127608]",
    expect: {
      name: "iOS",
      version: "13.6.1",
    },
  },
  {
    desc: "iOS with Instagram",
    ua: "Instagram 5.0.2 (iPhone5,1; iPhone OS 7_0_4; en_US; en) AppleWebKit/420+",
    expect: {
      name: "iOS",
      version: "7.0.4",
    },
  },
  {
    desc: "iOS with MS Word App",
    ua: "Microsoft Office Word/2.44.1211 (iOS/13.7; Tablet; es-MX; AppStore; Apple/iPad11,3)",
    expect: {
      name: "iOS",
      version: "13.7",
    },
  },
  {
    desc: "iOS with Quora App",
    ua: "Quora 8.4.30 rv:3230 env:prod (iPad11,3; iPadOS 17.7; en_GB) AppleWebKit",
    expect: {
      name: "iOS",
      version: "17.7",
    },
  },
  {
    desc: "iOS with Slack App",
    ua: "com.tinyspeck.chatlyio/23.04.10 (iPhone; iOS 16.4.1; Scale/3.00)",
    expect: {
      name: "iOS",
      version: "16.4.1",
    },
  },
  {
    desc: "iOS with Snapchat",
    ua: "Snapchat/12.12.1.40 (iPhone15,2; iOS 16.2; gzip)",
    expect: {
      name: "iOS",
      version: "16.2",
    },
  },
  {
    desc: "iOS with Spotify App",
    ua: "Spotify/8.7.70 iOS/16.0 (iPhone15,3)",
    expect: {
      name: "iOS",
      version: "16.0",
    },
  },
  {
    desc: "iOS with TuneIn Radio App",
    ua: "TuneIn Radio/27.1.0; iPad6,3; iPadOS/16.6",
    expect: {
      name: "iOS",
      version: "16.6",
    },
  },
  {
    desc: "iOS BE App",
    ua: "APP-BE Test/1.0 (iPad; Apple; CPU iPhone OS 7_0_2 like Mac OS X)",
    expect: {
      name: "iOS",
      version: "7.0.2",
    },
  },
  {
    desc: "Apple HomePod",
    ua: "AppleCoreMedia/1.0.0.15D61 (HomePod; U; CPU OS 11_2_5 like Mac OS X; en_us)",
    expect: {
      name: "iOS",
      version: "11.2.5",
    },
  },
  {
    desc: "iOS",
    ua: "iPlayTV/3.3.9 (Apple TV; iOS 16.1; Scale/1.00)",
    expect: {
      name: "iOS",
      version: "16.1",
    },
  },
  {
    desc: "iOS",
    ua: "itunesstored/1.0 iOS/8.4.4 AppleTV/7.8 model/AppleTV3,2 build/12H937 (3; dt:12)",
    expect: {
      name: "iOS",
      version: "8.4.4",
    },
  },
  {
    desc: "tvOS",
    ua: "iMPlayer/1.6.1 (tvOS 26.0.1)",
    expect: {
      name: "iOS",
      version: "26.0.1",
    },
  },
  {
    desc: "tvOS",
    ua: "otg/1.5.1 (AppleTv Apple TV 4; tvOS16.2; appletv.client) libcurl/7.58.0 OpenSSL/1.0.2o zlib/1.2.11 clib/1.8.56",
    expect: {
      name: "iOS",
      version: "16.2",
    },
  },
  {
    desc: "Windows 3.1",
    ua: "NCSA_Mosaic/2.0 (Windows 3.1)",
    expect: {
      name: "Windows",
      version: "3.1",
    },
  },
  {
    desc: "Windows 3.1",
    ua: "Mozilla/1.22 (compatible; MSIE 2.0; Windows 3.1)",
    expect: {
      name: "Windows",
      version: "3.1",
    },
  },
  {
    desc: "Windows NT",
    ua: "Mozilla/4.51 [de] (WinNT; I)",
    expect: {
      name: "Windows",
      version: "NT",
    },
  },
  {
    desc: "Windows NT 3.51",
    ua: "Mozilla/4.0 (compatible; MSIE 4.0; Windows NT)",
    expect: {
      name: "Windows",
      version: "NT",
    },
  },
  {
    desc: "Windows NT 3.51",
    ua: "Mozilla/4.0 (compatible; MSIE 5.05; Windows NT 3.51)",
    expect: {
      name: "Windows",
      version: "NT 3.51",
    },
  },
  {
    desc: "Windows NT 4.0",
    ua: "Opera/8.41.(Windows NT 4.0; ts-ZA) Presto/2.9.178 Version/11.00",
    expect: {
      name: "Windows",
      version: "NT 4.0",
    },
  },
  {
    desc: "Windows NT 4.0",
    ua: "Mozilla/5.0 (Windows; U; WinNT4.0; de-DE; rv:1.7.5) Gecko/20041108 Firefox/52.7.4",
    expect: {
      name: "Windows",
      version: "NT 4.0",
    },
  },
  {
    desc: "Netscape on Windows 95",
    ua: "Mozilla/5.0 (Windows; U; Win95; de-DE; rv:0.9.2) Gecko/20010726 Netscape6/6.1",
    expect: {
      name: "Windows",
      version: "95",
    },
  },
  {
    desc: "Windows 95",
    ua: "Mozilla/3.0 (Win95)",
    expect: {
      name: "Windows",
      version: "95",
    },
  },
  {
    desc: "Windows 95",
    ua: "Mozilla/3.0 (compatible; Opera/3.0; Windows 95/NT4) 3.2",
    expect: {
      name: "Windows",
      version: "95",
    },
  },
  {
    desc: "Windows 95",
    ua: "Mozilla/4.0 (compatible; MSIE 5.0; Windows 95) Opera 6.02 [en]",
    expect: {
      name: "Windows",
      version: "95",
    },
  },
  {
    desc: "Windows 95",
    ua: "Mozilla/1.22 (compatible; MSIE 2.0; Windows 95)",
    expect: {
      name: "Windows",
      version: "95",
    },
  },
  {
    desc: "Windows 98",
    ua: "Mozilla/4.0 (compatible; MSIE 4.01; Windows 98)",
    expect: {
      name: "Windows",
      version: "98",
    },
  },
  {
    desc: "Firebird on Windows 98",
    ua: "Mozilla/5.0 (Windows; U; Win98; en-US; rv:1.5) Gecko/20031007 Firebird/0.7",
    expect: {
      name: "Windows",
      version: "98",
    },
  },
  {
    desc: "K-Meleon on Windows 98",
    ua: "Mozilla/5.0 (Windows; U; Win98; en-US; rv:1.5) Gecko/20031016 K-Meleon/0.8.2",
    expect: {
      name: "Windows",
      version: "98",
    },
  },
  {
    desc: "Windows ME",
    ua: "Mozilla/5.0 (Windows; U; Win 9x 4.90) Gecko/20020502 CS 2000 7.0/7.0",
    expect: {
      name: "Windows",
      version: "ME",
    },
  },
  {
    desc: "Opera on Windows ME",
    ua: "Mozilla/4.0 (compatible; MSIE 5.0; Windows ME) Opera 5.12 [de]",
    expect: {
      name: "Windows",
      version: "ME",
    },
  },
  {
    desc: "Netscape on Windows ME",
    ua: "Mozilla/5.0 (Windows; U; Win 9x 4.90; en-US; rv:1.8.1.8pre) Gecko/20071015 Firefox/2.0.0.7 Navigator/9.0",
    expect: {
      name: "Windows",
      version: "ME",
    },
  },
  {
    desc: "Netscape on Windows 2000",
    ua: "Mozilla/5.0 (Windows; U; Windows NT 5.0; en-US; rv:1.7.5) Gecko/20050519 Netscape/8.0.1",
    expect: {
      name: "Windows",
      version: "2000",
    },
  },
  {
    desc: "Opera on Windows 2000",
    ua: "Opera/6.05 (Windows 2000; U)",
    expect: {
      name: "Windows",
      version: "2000",
    },
  },
  {
    desc: "Opera on Windows 2000",
    ua: "Opera/9.69 (Windows NT 5.01; en-US) Presto/2.8.160 Version/10.00",
    expect: {
      name: "Windows",
      version: "2000",
    },
  },
  {
    desc: "Windows 2000",
    ua: "Mozilla/3.0 (compatible; MSIE 3.0; Windows NT 5.0)",
    expect: {
      name: "Windows",
      version: "2000",
    },
  },
  {
    desc: "Windows XP",
    ua: "Mozilla/5.0 (Windows; U; MSIE 7.0; Windows NT 5.2)",
    expect: {
      name: "Windows",
      version: "XP",
    },
  },
  {
    desc: "Windows XP",
    ua: "Mozilla/5.0 (Windows XP; U) Opera 6.05  [de]",
    expect: {
      name: "Windows",
      version: "XP",
    },
  },
  {
    desc: "Windows Vista",
    ua: "Mozilla/5.0 (compatible; MSIE 7.0; Windows NT 6.0; fr-FR)",
    expect: {
      name: "Windows",
      version: "Vista",
    },
  },
  {
    desc: "Windows 7",
    ua: "Microsoft Windows 7",
    expect: {
      name: "Windows",
      version: "7",
    },
  },
  {
    desc: "Windows 7",
    ua: "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Evernote Windows/306387 (pt-PT, DDL); Windows/6.1.0 (Win32); Safari/537.36",
    expect: {
      name: "Windows",
      version: "7",
    },
  },
  {
    desc: "Windows 7",
    ua: "Mozilla/5.0 (Windows 7 Enterprise; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6099.71 Safari/537.36",
    expect: {
      name: "Windows",
      version: "7",
    },
  },
  {
    desc: "Windows 7",
    ua: "Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1; Trident/6.0)",
    expect: {
      name: "Windows",
      version: "7",
    },
  },
  {
    desc: "Windows 8",
    ua: "Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.2; Win64; x64; Trident/6.0; .NET4.0E; .NET4.0C)",
    expect: {
      name: "Windows",
      version: "8",
    },
  },
  {
    desc: "Windows 8.1",
    ua: "Mozilla/5.0 (Windows NT 6.3; WOW64; rv:66.0.5) Gecko/20100101 Firefox/66.0.5",
    expect: {
      name: "Windows",
      version: "8.1",
    },
  },
  {
    desc: "Windows 10",
    ua: "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.71 Safari/537.36 Edge/12.0",
    expect: {
      name: "Windows",
      version: "10",
    },
  },
  {
    desc: "Windows Server 2012 R2",
    ua: "Mozilla/5.0 (Windows Server 2012 R2 Standard; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5975.80 Safari/537.36",
    expect: {
      name: "Windows",
      version: "Server 2012 R2",
    },
  },
  {
    desc: "WeChat Desktop for Windows Built-in Browser",
    ua: "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.95 Safari/537.36 MicroMessenger/6.5.2.501 NetType/WIFI WindowsWechat QBCore/3.43.901.400 QQBrowser/9.0.2524.400",
    expect: {
      name: "Windows",
      version: "7",
    },
  },
  {
    desc: "WeChat Desktop for Windows Built-in Browser major version in 4",
    ua: "mozilla/5.0 (windows nt 6.1; wow64) applewebkit/537.36 (khtml, like gecko) chrome/81.0.4044.138 safari/537.36 nettype/wifi micromessenger/7.0.20.1781(0x6700143b) windowswechat",
    expect: {
      name: "Windows",
      version: "7",
    },
  },
  {
    desc: "iTunes on Windows Vista",
    ua: "iTunes/10.7 (Windows; Microsoft Windows Vista Home Premium Edition Service Pack 1 (Build 6001)) AppleWebKit/536.26.9",
    expect: {
      name: "Windows",
      version: "Vista",
    },
  },
  {
    desc: "iTunes on Windows 7",
    ua: "iTunes/10.6.3 (Windows; Microsoft Windows 7 x64 Business Edition Service Pack 1 (Build 7601)) AppleWebKit/534.57.2",
    expect: {
      name: "Windows",
      version: "7",
    },
  },
  {
    desc: "iTunes on Windows 8",
    ua: "iTunes/12.1.1 (Windows; Microsoft Windows 8 x64 Business Edition (Build 9200)) AppleWebKit/7600.1017.9000.2",
    expect: {
      name: "Windows",
      version: "8",
    },
  },
  {
    desc: "iTunes on Windows 8.1",
    ua: "iTunes/12.4 (Windows; Microsoft Windows 8.1 x64 Business Edition (Build 9200); x64) AppleWebKit/7601.6016.1000.1",
    expect: {
      name: "Windows",
      version: "8.1",
    },
  },
  {
    desc: "iTunes on Windows 10",
    ua: "iTunes/12.9.1 (Windows; Microsoft Windows 10 x64 Professional Edition (Build 18362); x64) AppleWebKit/7606.2104.0.21",
    expect: {
      name: "Windows",
      version: "10",
    },
  },
  {
    desc: "iTunes on Windows 10",
    ua: "iTunes/12.6.3 (Windows; Microsoft Windows 10.0 x64 (Build 17763); x64) AppleWebKit/7604.1038.1006.6",
    expect: {
      name: "Windows",
      version: "10",
    },
  },
  {
    desc: "iTunes on Windows 10 S",
    ua: "iTunes/12.12 (Windows; Microsoft Windows 10 S x64; x64) AppleWebKit/7613.2007",
    expect: {
      name: "Windows",
      version: "10",
    },
  },
  {
    desc: "iTunes on Windows 11",
    ua: "iTunes/12.13 (Windows; Microsoft Windows 11 x64; x64) AppleWebKit/7613.2007",
    expect: {
      name: "Windows",
      version: "11",
    },
  },
  {
    desc: "Mac OS on PowerPC",
    ua: "Mozilla/4.0 (compatible; MSIE 5.0b1; Mac_PowerPC)",
    expect: {
      name: "macOS",
      version: "undefined",
    },
  },
  {
    desc: "Mac OS X on x86, x86_64, or aarch64 using Firefox",
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X x.y; rv:10.0) Gecko/20100101 Firefox/10.0",
    expect: {
      name: "macOS",
      version: "x.y",
    },
  },
  {
    desc: "Mac OS X on PowerPC using Firefox",
    ua: "Mozilla/5.0 (Macintosh; PPC Mac OS X x.y; rv:10.0) Gecko/20100101 Firefox/10.0",
    expect: {
      name: "macOS",
      version: "x.y",
    },
  },
  {
    desc: "Mac OS",
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1500.95 Safari/537.36",
    expect: {
      name: "macOS",
      version: "10.6.8",
    },
  },
  {
    desc: "Linux",
    ua: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.157 Safari/537.36",
    expect: {
      name: "Linux",
      version: "undefined",
    },
  },
  {
    desc: "Linux",
    ua: "Mozilla/5.0 (X11; U; Linux armv61; en-US; rv:1.9.1b2pre) Gecko/20081015 Fennec/1.0a1",
    expect: {
      name: "Linux",
      version: "undefined",
    },
  },
  {
    desc: "Chrome OS",
    ua: "Mozilla/5.0 (X11; CrOS x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.0.0 Safari/537.36",
    expect: {
      name: "Chrome OS",
      version: "undefined",
    },
  },
  {
    desc: "Chromium OS",
    ua: "Mozilla/5.0 (X11; CrOS x86_64 10575.58.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.99 Safari/537.36",
    expect: {
      name: "Chrome OS",
      version: "10575.58.0",
    },
  },
  {
    desc: "Ubuntu",
    ua: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/535.22+ (KHTML, like Gecko) Chromium/17.0.963.56 Chrome/17.0.963.56 Safari/535.22+ Ubuntu/12.04 (3.4.1-0ubuntu1) Epiphany/3.4.1",
    expect: {
      name: "Ubuntu",
      version: "12.04",
    },
  },
  {
    desc: "Ubuntu",
    ua: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/31.0.1650.63 Chrome/31.0.1650.63 Safari/537.36",
    expect: {
      name: "Ubuntu",
      version: "undefined",
    },
  },
  {
    desc: "Ubuntu",
    ua: "Mozilla/5.0 (Wayland; Linux x86_64; Huawei) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36 Ubuntu/23.04 Edg/110.0.1587.41",
    expect: {
      name: "Ubuntu",
      version: "23.04",
    },
  },
  {
    desc: "Ubuntu",
    ua: "Mozilla/5.0 (X11; Ubuntu 20.04; Linux arm; rv:99.0) Gecko/20100101 Firefox/99.0",
    expect: {
      name: "Ubuntu",
      version: "20.04",
    },
  },
  {
    desc: "Ubuntu",
    ua: "Opera/9.80 (X11; Linux i686; Ubuntu/14.10) Presto/2.12.388 Version/12.16",
    expect: {
      name: "Ubuntu",
      version: "14.10",
    },
  },
];
